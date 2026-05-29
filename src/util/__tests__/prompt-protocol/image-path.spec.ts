import { isValidImagePath, parseImageScale } from '@/util/prompt-protocol/image-path'

describe('isValidImagePath', () => {
  it.each<[string, boolean]>([
    ['config/spool.svg', true],
    ['config/images/spool.svg', true],
    ['config/prompt-assets/blue-pla.png', true],
    ['config/a/b/c/d/e.jpg', true],
    // Invalid: missing config/ prefix
    ['spool.svg', false],
    ['images/spool.svg', false],
    // Invalid: leading slash or tilde
    ['/config/spool.svg', false],
    ['~/spool.svg', false],
    ['~config/spool.svg', false],
    // Invalid: empty segments
    ['config//spool.svg', false],
    ['config/', false],
    // Invalid: . or .. segments
    ['config/./spool.svg', false],
    ['config/../etc/passwd', false],
    ['config/sub/../sibling/x.svg', false],
    ['config/.hidden.svg', true], // a filename starting with . is fine; only `.` or `..` as full segments are illegal
    // Invalid: colon in segment
    ['config/C:/spool.svg', false],
    ['config/sub:dir/x.svg', false],
    // Invalid: remote URLs
    ['http://example.com/spool.svg', false],
    ['https://example.com/spool.svg', false],
    ['file:///etc/passwd', false],
    // Invalid: empty
    ['', false]
  ])('treats "%s" valid=%s', (path, expected) => {
    expect(isValidImagePath(path)).toBe(expected)
  })
})

describe('parseImageScale', () => {
  it.each<[string | undefined, number | null]>([
    [undefined, null],
    ['', null],
    ['1', 1],
    ['0.75', 0.75],
    ['2.5', 2.5],
    // Invalid: zero, negative, non-finite
    ['0', null],
    ['-1', null],
    ['-0.5', null],
    ['Infinity', null],
    ['NaN', null],
    // Invalid: non-`.` decimal separator
    ['0,75', null],
    // Invalid: non-numeric
    ['abc', null],
    ['1.5abc', null],
    // Whitespace handling
    ['  0.5  ', 0.5]
  ])('parses scale "%s" → %s', (input, expected) => {
    expect(parseImageScale(input)).toBe(expected)
  })
})
