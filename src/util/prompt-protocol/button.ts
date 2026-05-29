import { normalizeStyle } from './style'
import type { PromptStyle } from './types'

export interface ParsedButton {
  label: string
  gcode: string
  style: PromptStyle
}

export function parseButtonFields (param: string | undefined): ParsedButton | null {
  if (typeof param !== 'string') return null
  const parts = param.split('|')
  const label = (parts[0] ?? '').trim()
  if (label.length === 0) return null

  const rawGcode = (parts[1] ?? '').trim()
  const gcode = rawGcode.length > 0 ? rawGcode : label

  const style = normalizeStyle(parts[2])

  return { label, gcode, style }
}
