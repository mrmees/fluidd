import { normalizeStyle, isPromptStyle } from '@/util/prompt-protocol/style'

describe('normalizeStyle', () => {
  it.each([
    ['primary', 'primary'],
    ['secondary', 'secondary'],
    ['info', 'info'],
    ['warning', 'warning'],
    ['error', 'error'],
    ['success', 'success'],
    ['PRIMARY', 'primary'],
    ['  Warning  ', 'warning'],
    ['', 'secondary'],
    ['unknown', 'secondary'],
    [undefined, 'secondary']
  ])('normalizes "%s" → "%s"', (input, expected) => {
    expect(normalizeStyle(input)).toBe(expected)
  })
})

describe('isPromptStyle', () => {
  it.each([
    ['primary', true],
    ['secondary', true],
    ['unknown', false],
    ['', false],
    ['Primary', false]
  ])('detects "%s" → %s', (value, expected) => {
    expect(isPromptStyle(value)).toBe(expected)
  })
})
