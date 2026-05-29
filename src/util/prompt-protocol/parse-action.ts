import { parseButtonFields } from './button'
import { parseImageScale } from './image-path'
import { parseMarkup } from './markup'
import type { MarkupNode, PromptStyle, PromptSize } from './types'

export type ProtocolEvent =
  | { kind: 'begin'; title: string }
  | { kind: 'text'; text: string }
  | { kind: 'markup'; ast: MarkupNode[] }
  | { kind: 'image'; path: string; alt: string; scale: number | null }
  | { kind: 'button'; label: string; gcode: string; style: PromptStyle }
  | { kind: 'footer_button'; label: string; gcode: string; style: PromptStyle }
  | { kind: 'show' }
  | { kind: 'end' }
  | { kind: 'target'; targets: string[] }
  | { kind: 'size'; size: PromptSize }
  | { kind: 'row_start' }
  | { kind: 'row_end' }
  | { kind: 'button_group_start' }
  | { kind: 'button_group_end' }
  | { kind: 'disconnect' }
  | { kind: 'unknown'; command: string }

const SIZE_NORMAL: PromptSize = 'normal'
const VALID_SIZES: ReadonlySet<PromptSize> = new Set(['small', 'normal', 'large', 'x-large'])

function normalizeSize (raw: string | undefined): PromptSize {
  if (typeof raw !== 'string') return SIZE_NORMAL
  const trimmed = raw.trim().toLowerCase()
  return (VALID_SIZES as ReadonlySet<string>).has(trimmed) ? trimmed as PromptSize : SIZE_NORMAL
}

// Strip canonical prefixes: "// action:" or "action:" leading text.
// Returns null if the remaining text does not look like a prompt_* command.
function canonicalize (rawLine: string): string | null {
  if (typeof rawLine !== 'string') return null
  let line = rawLine
  if (line.startsWith('// action:')) line = line.slice('// action:'.length)
  else if (line.startsWith('action:')) line = line.slice('action:'.length)
  if (!line.startsWith('prompt_')) return null
  return line.slice('prompt_'.length)
}

export function parseAction (rawLine: string): ProtocolEvent | null {
  const command = canonicalize(rawLine)
  if (command === null) return null

  const spaceIdx = command.indexOf(' ')
  const name = spaceIdx === -1 ? command : command.slice(0, spaceIdx)
  const param = spaceIdx === -1 ? '' : command.slice(spaceIdx + 1)

  switch (name) {
    case 'begin':
      return { kind: 'begin', title: param }
    case 'text':
      return { kind: 'text', text: param }
    case 'show':
      return { kind: 'show' }
    case 'end':
      return { kind: 'end' }
    case 'button': {
      const parsed = parseButtonFields(param)
      if (!parsed) return { kind: 'unknown', command: 'button' }
      return { kind: 'button', ...parsed }
    }
    case 'footer_button': {
      const parsed = parseButtonFields(param)
      if (!parsed) return { kind: 'unknown', command: 'footer_button' }
      return { kind: 'footer_button', ...parsed }
    }
    case 'target': {
      const targets = param
        .split(',')
        .map(s => s.trim().toLowerCase())
        .filter(s => s.length > 0)
      return { kind: 'target', targets }
    }
    case 'size':
      return { kind: 'size', size: normalizeSize(param) }
    case 'row_start':
      return { kind: 'row_start' }
    case 'row_end':
      return { kind: 'row_end' }
    case 'button_group_start':
      return { kind: 'button_group_start' }
    case 'button_group_end':
      return { kind: 'button_group_end' }
    case 'image': {
      const parts = param.split('|')
      const path = (parts[0] ?? '').trim()
      const alt = (parts[1] ?? '').trim()
      const scale = parseImageScale(parts[2])
      return { kind: 'image', path, alt, scale }
    }
    case 'markup':
      return { kind: 'markup', ast: parseMarkup(param) }
    default:
      return { kind: 'unknown', command: name }
  }
}
