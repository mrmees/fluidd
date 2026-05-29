import { parseButtonFields } from '@/util/prompt-protocol/button'

describe('parseButtonFields', () => {
  it('parses full label|gcode|style', () => {
    expect(parseButtonFields('Do thing|_PROMPT_DO_THING|primary')).toEqual({
      label: 'Do thing',
      gcode: '_PROMPT_DO_THING',
      style: 'primary'
    })
  })

  it('defaults gcode to label when missing', () => {
    expect(parseButtonFields('Cancel')).toEqual({
      label: 'Cancel',
      gcode: 'Cancel',
      style: 'secondary'
    })
  })

  it('defaults gcode to label when empty', () => {
    expect(parseButtonFields('Cancel||primary')).toEqual({
      label: 'Cancel',
      gcode: 'Cancel',
      style: 'primary'
    })
  })

  it('defaults style to secondary when missing', () => {
    expect(parseButtonFields('Cancel|_CANCEL')).toEqual({
      label: 'Cancel',
      gcode: '_CANCEL',
      style: 'secondary'
    })
  })

  it('defaults style to secondary when empty', () => {
    expect(parseButtonFields('Cancel|_CANCEL|')).toEqual({
      label: 'Cancel',
      gcode: '_CANCEL',
      style: 'secondary'
    })
  })

  it('defaults style to secondary when unknown', () => {
    expect(parseButtonFields('Cancel|_CANCEL|funky')).toEqual({
      label: 'Cancel',
      gcode: '_CANCEL',
      style: 'secondary'
    })
  })

  it('normalizes style case', () => {
    expect(parseButtonFields('OK|_OK|PRIMARY')).toEqual({
      label: 'OK',
      gcode: '_OK',
      style: 'primary'
    })
  })

  it('returns null for empty label', () => {
    expect(parseButtonFields('')).toBeNull()
    expect(parseButtonFields('|gcode|primary')).toBeNull()
    expect(parseButtonFields('   ')).toBeNull()
    expect(parseButtonFields('  |gcode|primary')).toBeNull()
  })

  it('preserves internal whitespace in label and gcode', () => {
    expect(parseButtonFields('Press me|GCODE WITH ARGS|primary')).toEqual({
      label: 'Press me',
      gcode: 'GCODE WITH ARGS',
      style: 'primary'
    })
  })

  it('trims whitespace around label and gcode', () => {
    expect(parseButtonFields('  OK  |  _OK  |primary')).toEqual({
      label: 'OK',
      gcode: '_OK',
      style: 'primary'
    })
  })

  it('ignores extra pipe fields beyond style', () => {
    // Spec: pipe is reserved; macros must not put | in labels/gcode/styles.
    // If they do, downstream fields are dropped silently rather than corrupting earlier ones.
    expect(parseButtonFields('OK|_OK|primary|extra')).toEqual({
      label: 'OK',
      gcode: '_OK',
      style: 'primary'
    })
  })
})
