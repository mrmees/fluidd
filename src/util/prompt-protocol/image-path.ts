export function isValidImagePath (path: string): boolean {
  if (typeof path !== 'string' || path.length === 0) return false
  if (path.startsWith('/') || path.startsWith('~')) return false
  // Forward slashes only — backslash anywhere is invalid.
  if (path.includes('\\')) return false

  const segments = path.split('/')
  if (segments[0] !== 'config') return false
  if (segments.length < 2) return false

  for (const segment of segments) {
    if (segment.length === 0) return false
    if (segment === '.' || segment === '..') return false
    if (segment.includes(':')) return false
  }

  return true
}

export function parseImageScale (input: string | undefined): number | null {
  if (input === undefined) return null
  const trimmed = input.trim()
  if (trimmed.length === 0) return null
  // Reject comma decimals explicitly (spec: decimal separator is `.`).
  if (trimmed.includes(',')) return null
  // Require strict numeric form — reject "1.5abc" etc.
  if (!/^[+-]?(?:\d+(?:\.\d+)?|\.\d+)$/.test(trimmed)) return null
  const n = Number(trimmed)
  if (!Number.isFinite(n) || n <= 0) return null
  return n
}
