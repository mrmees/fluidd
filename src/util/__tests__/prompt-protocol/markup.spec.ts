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

describe('parseMarkup — tags', () => {
  it('parses a single <b> tag', () => {
    expect(parseMarkup('<b>Bold</b>')).toEqual([
      { type: 'tag', tag: 'b', children: [{ type: 'text', text: 'Bold' }] }
    ])
  })

  it('parses <i> and <u> simple tags', () => {
    expect(parseMarkup('<i>It</i>')).toEqual([
      { type: 'tag', tag: 'i', children: [{ type: 'text', text: 'It' }] }
    ])
    expect(parseMarkup('<u>Un</u>')).toEqual([
      { type: 'tag', tag: 'u', children: [{ type: 'text', text: 'Un' }] }
    ])
  })

  it('parses nested <b><i>...</i></b>', () => {
    expect(parseMarkup('<b><i>BI</i></b>')).toEqual([
      {
        type: 'tag',
        tag: 'b',
        children: [{
          type: 'tag',
          tag: 'i',
          children: [{ type: 'text', text: 'BI' }]
        }]
      }
    ])
  })

  it('parses adjacent text and tags', () => {
    expect(parseMarkup('Hi <b>there</b>!')).toEqual([
      { type: 'text', text: 'Hi ' },
      { type: 'tag', tag: 'b', children: [{ type: 'text', text: 'there' }] },
      { type: 'text', text: '!' }
    ])
  })

  it('parses <color:#22c55e> value tags', () => {
    expect(parseMarkup('<color:#22c55e>Green</color>')).toEqual([
      { type: 'tag', tag: 'color', value: '#22c55e', children: [{ type: 'text', text: 'Green' }] }
    ])
  })

  it('parses <bgcolor:#XXXXXX>', () => {
    expect(parseMarkup('<bgcolor:#ff0000>Red bg</bgcolor>')).toEqual([
      { type: 'tag', tag: 'bgcolor', value: '#ff0000', children: [{ type: 'text', text: 'Red bg' }] }
    ])
  })

  it('parses <size:large>', () => {
    expect(parseMarkup('<size:large>Big</size>')).toEqual([
      { type: 'tag', tag: 'size', value: 'large', children: [{ type: 'text', text: 'Big' }] }
    ])
  })

  it('accepts uppercase color hex digits', () => {
    expect(parseMarkup('<color:#FF00AA>X</color>')).toEqual([
      { type: 'tag', tag: 'color', value: '#FF00AA', children: [{ type: 'text', text: 'X' }] }
    ])
  })

  it('strips unknown tag, preserves children', () => {
    expect(parseMarkup('<funky>kept</funky>')).toEqual([
      { type: 'text', text: 'kept' }
    ])
  })

  it('strips invalid color (3-char hex), preserves children', () => {
    expect(parseMarkup('<color:#fff>x</color>')).toEqual([
      { type: 'text', text: 'x' }
    ])
  })

  it('strips invalid color (named), preserves children', () => {
    expect(parseMarkup('<color:red>x</color>')).toEqual([
      { type: 'text', text: 'x' }
    ])
  })

  it('strips invalid size value, preserves children', () => {
    expect(parseMarkup('<size:huge>x</size>')).toEqual([
      { type: 'text', text: 'x' }
    ])
  })

  it('treats orphan opening tag as literal text', () => {
    // Spec: unsupported frontends should strip markup and display readable plain text.
    // Best-effort recovery here: an unmatched <b> appears as literal text.
    expect(parseMarkup('<b>oops')).toEqual([
      { type: 'text', text: '<b>oops' }
    ])
  })

  it('treats orphan closing tag as literal text', () => {
    expect(parseMarkup('oops</b>')).toEqual([
      { type: 'text', text: 'oops</b>' }
    ])
  })

  it('treats mismatched closing tag as literal text', () => {
    // <b>...</i> — the </i> does not match the open <b>; emit best-effort.
    // We close the open tag at the mismatch and treat the rest as text.
    expect(parseMarkup('<b>x</i>y')).toEqual([
      { type: 'tag', tag: 'b', children: [{ type: 'text', text: 'x' }] },
      { type: 'text', text: '</i>y' }
    ])
  })

  it('decodes entities inside tags', () => {
    expect(parseMarkup('<b>&lt;</b>')).toEqual([
      { type: 'tag', tag: 'b', children: [{ type: 'text', text: '<' }] }
    ])
  })

  it('toPlainText walks nested tags', () => {
    expect(toPlainText(parseMarkup('<b><color:#22c55e>OK</color> done</b>'))).toBe('OK done')
  })

  it('treats malformed `<` not followed by tag-like start as literal', () => {
    expect(parseMarkup('1 < 2')).toEqual([{ type: 'text', text: '1 < 2' }])
  })

  it('case-insensitive size value normalizes to lowercase', () => {
    expect(parseMarkup('<size:LARGE>x</size>')).toEqual([
      { type: 'tag', tag: 'size', value: 'large', children: [{ type: 'text', text: 'x' }] }
    ])
  })

  it('rejects uppercase tag names (case-sensitive per spec grammar)', () => {
    expect(parseMarkup('<B>x</B>')).toEqual([
      { type: 'text', text: '<B>x</B>' }
    ])
  })

  it('handles nested unclosed tags in readable order', () => {
    // <b><i>text → b wraps i wraps text. With no closes, recover by emitting
    // <b><i> as literal text followed by the inner text.
    const result = parseMarkup('<b><i>text')
    const plain = toPlainText(result)
    // The "<b>" should appear before "<i>" in the output (outer first).
    const bIdx = plain.indexOf('<b>')
    const iIdx = plain.indexOf('<i>')
    expect(bIdx).toBeGreaterThanOrEqual(0)
    expect(iIdx).toBeGreaterThan(bIdx)
    expect(plain).toContain('text')
  })
})
