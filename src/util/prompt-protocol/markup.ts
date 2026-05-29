// src/util/prompt-protocol/markup.ts
import type { MarkupNode, PromptSize } from './types'

const ENTITY_MAP: Record<string, string> = {
  '&lt;': '<',
  '&gt;': '>',
  '&amp;': '&'
}

// Decode entities and \n escapes in a single left-to-right pass.
// Decoded output is NOT reparsed (entity bomb defense per spec).
function decodeEscapes (input: string): string {
  let out = ''
  let i = 0
  while (i < input.length) {
    const ch = input[i]
    if (ch === '&') {
      let matched = false
      for (const entity of Object.keys(ENTITY_MAP)) {
        if (input.startsWith(entity, i)) {
          out += ENTITY_MAP[entity]
          i += entity.length
          matched = true
          break
        }
      }
      if (!matched) {
        out += ch
        i += 1
      }
    } else if (ch === '\\' && input[i + 1] === 'n') {
      out += '\n'
      i += 2
    } else {
      out += ch
      i += 1
    }
  }
  return out
}

const SIMPLE_TAGS = new Set(['b', 'i', 'u'])
const VALUE_TAGS = new Set(['color', 'bgcolor', 'size'])
const VALID_SIZES: ReadonlySet<PromptSize> = new Set<PromptSize>(['small', 'normal', 'large', 'x-large'])
const HEX_COLOR_RE = /^#[0-9a-f]{6}$/i

// A tag name is a sequence of lowercase letters (and optionally digits/hyphens).
// Case-sensitive per spec: uppercase tag names do NOT match.
const TAG_NAME_RE = /^[a-z][a-z0-9-]*$/

interface OpenTag {
  tag: string
  value: string | null
  children: MarkupNode[]
}

type Token =
  | { kind: 'open'; length: number; tag: string; value: string | null; known: boolean }
  | { kind: 'close'; length: number; tag: string; known: boolean }

function scanTag (input: string, i: number): Token | null {
  if (input[i] !== '<') return null
  const closeBracket = input.indexOf('>', i + 1)
  if (closeBracket === -1) return null
  const inner = input.slice(i + 1, closeBracket)
  if (inner.length === 0) return null
  const length = closeBracket - i + 1

  if (inner.startsWith('/')) {
    const tag = inner.slice(1)
    if (!TAG_NAME_RE.test(tag)) return null
    const known = SIMPLE_TAGS.has(tag) || VALUE_TAGS.has(tag)
    return { kind: 'close', length, tag, known }
  }

  const colon = inner.indexOf(':')
  if (colon > 0) {
    const tag = inner.slice(0, colon)
    const rawValue = inner.slice(colon + 1)
    if (!TAG_NAME_RE.test(tag)) return null
    const known = VALUE_TAGS.has(tag)
    return { kind: 'open', length, tag, value: rawValue, known }
  }

  if (!TAG_NAME_RE.test(inner)) return null
  const known = SIMPLE_TAGS.has(inner)
  return { kind: 'open', length, tag: inner, value: null, known }
}

function isValidValueForTag (tag: string, rawValue: string): boolean {
  if (tag === 'color' || tag === 'bgcolor') {
    return HEX_COLOR_RE.test(rawValue)
  }
  if (tag === 'size') {
    return (VALID_SIZES as ReadonlySet<string>).has(rawValue.toLowerCase())
  }
  return false
}

function normalizeValueForTag (tag: string, rawValue: string): string {
  // Hex preserved as-given (per test expectations); size lowercased.
  if (tag === 'size') return rawValue.toLowerCase()
  return rawValue
}

// Push a text node, merging with the previous node if it is also text.
function pushText (nodes: MarkupNode[], text: string): void {
  if (text.length === 0) return
  const last = nodes[nodes.length - 1]
  if (last !== undefined && last.type === 'text') {
    last.text += text
  } else {
    nodes.push({ type: 'text', text })
  }
}

function buildAst (input: string): MarkupNode[] {
  const root: MarkupNode[] = []
  const stack: OpenTag[] = []
  let textBuffer = ''
  let i = 0

  const currentChildren = () => stack.length > 0 ? stack[stack.length - 1].children : root

  const flushText = () => {
    if (textBuffer.length === 0) return
    pushText(currentChildren(), decodeEscapes(textBuffer))
    textBuffer = ''
  }

  // Close the top of the stack and emit the resulting node (or flatten children).
  const closeTop = () => {
    flushText()
    const open = stack.pop()!
    const target = currentChildren()
    emitOpenTag(open, target)
  }

  const emitOpenTag = (open: OpenTag, target: MarkupNode[]) => {
    let node: MarkupNode | null = null
    if (open.value === null) {
      if (open.tag === 'b' || open.tag === 'i' || open.tag === 'u') {
        node = { type: 'tag', tag: open.tag, children: open.children }
      }
      // Unknown simple-style tag: fall through — node stays null, children inlined below
    } else {
      if (isValidValueForTag(open.tag, open.value)) {
        const value = normalizeValueForTag(open.tag, open.value)
        if (open.tag === 'color' || open.tag === 'bgcolor') {
          node = { type: 'tag', tag: open.tag, value, children: open.children }
        } else if (open.tag === 'size') {
          node = { type: 'tag', tag: 'size', value: value as PromptSize, children: open.children }
        }
      }
      // Invalid value or unknown value-tag: fall through — children inlined below
    }
    if (node !== null) {
      target.push(node)
    } else {
      // Strip the tag; inline its children.
      for (const child of open.children) {
        if (child.type === 'text') {
          pushText(target, child.text)
        } else {
          target.push(child)
        }
      }
    }
  }

  while (i < input.length) {
    if (input[i] === '<') {
      const token = scanTag(input, i)
      if (token === null) {
        textBuffer += input[i]
        i += 1
        continue
      }
      if (token.kind === 'open') {
        flushText()
        stack.push({ tag: token.tag, value: token.value !== null ? token.value : null, children: [] })
        i += token.length
        continue
      }
      if (token.kind === 'close') {
        if (stack.length > 0 && stack[stack.length - 1].tag === token.tag) {
          // Matched close: close the top of stack.
          closeTop()
          i += token.length
        } else if (stack.length > 0 && token.known) {
          // Mismatched known close tag: auto-close the top of stack, then treat
          // the mismatched close tag as literal text.
          closeTop()
          textBuffer += input.slice(i, i + token.length)
          i += token.length
        } else {
          // Unmatched close tag (stack empty, or unknown close tag): literal text.
          textBuffer += input.slice(i, i + token.length)
          i += token.length
        }
        continue
      }
    }
    textBuffer += input[i]
    i += 1
  }

  // Unclosed open tags → re-emit their literal `<tag>` and flatten children.
  while (stack.length > 0) {
    flushText()
    const open = stack.shift()!
    const literal = open.value !== null
      ? `<${open.tag}:${open.value}>`
      : `<${open.tag}>`
    const target = stack.length > 0 ? stack[0].children : root
    pushText(target, literal)
    for (const child of open.children) {
      if (child.type === 'text') {
        pushText(target, child.text)
      } else {
        target.push(child)
      }
    }
  }

  flushText()

  return root
}

export function parseMarkup (input: string): MarkupNode[] {
  if (typeof input !== 'string' || input.length === 0) return []
  return buildAst(input)
}

export function toPlainText (ast: MarkupNode[]): string {
  let out = ''
  for (const node of ast) {
    if (node.type === 'text') {
      out += node.text
    } else {
      out += toPlainText(node.children)
    }
  }
  return out
}
