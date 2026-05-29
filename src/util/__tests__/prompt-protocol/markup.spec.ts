// src/util/__tests__/prompt-protocol/markup.spec.ts
import { parseMarkup, toPlainText } from '@/util/prompt-protocol/markup'

describe('parseMarkup — text and entities', () => {
  it('parses plain text', () => {
    expect(parseMarkup('Hello world')).toEqual([{ type: 'text', text: 'Hello world' }])
  })

  it('parses empty string', () => {
    expect(parseMarkup('')).toEqual([])
  })

  it('decodes &lt; &gt; &amp;', () => {
    expect(parseMarkup('a &lt; b &gt; c &amp; d')).toEqual([
      { type: 'text', text: 'a < b > c & d' }
    ])
  })

  it('decodes &amp;lt; to literal &lt; (no double-decode)', () => {
    expect(parseMarkup('&amp;lt;')).toEqual([{ type: 'text', text: '&lt;' }])
  })

  it('decodes \\n to line break', () => {
    expect(parseMarkup('line1\\nline2')).toEqual([
      { type: 'text', text: 'line1\nline2' }
    ])
  })

  it('does not decode escapes inside an already-decoded entity payload', () => {
    expect(parseMarkup('&amp;amp;')).toEqual([{ type: 'text', text: '&amp;' }])
  })

  it('preserves literal text adjacent to decoded entities', () => {
    expect(parseMarkup('a&amp;b')).toEqual([{ type: 'text', text: 'a&b' }])
  })
})

describe('toPlainText', () => {
  it('returns empty string for empty AST', () => {
    expect(toPlainText([])).toBe('')
  })

  it('returns text from a single text node', () => {
    expect(toPlainText([{ type: 'text', text: 'Hello' }])).toBe('Hello')
  })

  it('concatenates multiple text nodes', () => {
    expect(toPlainText([
      { type: 'text', text: 'A' },
      { type: 'text', text: 'B' }
    ])).toBe('AB')
  })
})
