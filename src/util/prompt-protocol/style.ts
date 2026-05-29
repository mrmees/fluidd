import type { PromptStyle } from './types'

const KNOWN_STYLES: ReadonlySet<PromptStyle> = new Set<PromptStyle>([
  'primary', 'secondary', 'info', 'warning', 'error', 'success'
])

export function normalizeStyle (input: string | undefined): PromptStyle {
  if (typeof input !== 'string') return 'secondary'
  const normalized = input.trim().toLowerCase()
  return (KNOWN_STYLES as ReadonlySet<string>).has(normalized)
    ? normalized as PromptStyle
    : 'secondary'
}

/** Type guard for already-normalized style values. Does NOT trim or lowercase. */
export function isPromptStyle (value: string): value is PromptStyle {
  return (KNOWN_STYLES as ReadonlySet<string>).has(value)
}
