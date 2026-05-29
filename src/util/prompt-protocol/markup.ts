// src/util/prompt-protocol/markup.ts
import type { MarkupNode } from './types'

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
      // Match the longest known entity at this position.
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

export function parseMarkup (input: string): MarkupNode[] {
  if (typeof input !== 'string' || input.length === 0) return []
  // Tag parsing comes in the next task. For now, treat the entire input as text.
  return [{ type: 'text', text: decodeEscapes(input) }]
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
