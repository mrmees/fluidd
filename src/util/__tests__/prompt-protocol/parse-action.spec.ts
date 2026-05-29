// src/util/__tests__/prompt-protocol/parse-action.spec.ts
import { parseAction, type ProtocolEvent } from '@/util/prompt-protocol/parse-action'

describe('parseAction — non-prompt lines', () => {
  it('returns null for empty input', () => {
    expect(parseAction('')).toBeNull()
  })
  it('returns null for non-action line', () => {
    expect(parseAction('M114')).toBeNull()
  })
  it('returns null for unrelated action', () => {
    expect(parseAction('// action:notify_status_update message')).toBeNull()
  })
})

describe('parseAction — three input forms', () => {
  it('parses console-prefixed form', () => {
    expect(parseAction('// action:prompt_text Hello')).toEqual({ kind: 'text', text: 'Hello' })
  })
  it('parses bare action form', () => {
    expect(parseAction('action:prompt_text Hello')).toEqual({ kind: 'text', text: 'Hello' })
  })
  it('parses stripped form', () => {
    expect(parseAction('prompt_text Hello')).toEqual({ kind: 'text', text: 'Hello' })
  })
})

describe('parseAction — known commands', () => {
  it('parses begin with title', () => {
    expect(parseAction('prompt_begin My Title')).toEqual({ kind: 'begin', title: 'My Title' })
  })
  it('parses begin with empty title', () => {
    expect(parseAction('prompt_begin')).toEqual({ kind: 'begin', title: '' })
  })
  it('parses text', () => {
    expect(parseAction('prompt_text Some text')).toEqual({ kind: 'text', text: 'Some text' })
  })
  it('parses text with empty body', () => {
    expect(parseAction('prompt_text')).toEqual({ kind: 'text', text: '' })
  })
  it('parses show', () => {
    expect(parseAction('prompt_show')).toEqual({ kind: 'show' })
  })
  it('parses end', () => {
    expect(parseAction('prompt_end')).toEqual({ kind: 'end' })
  })
  it('parses button with full fields', () => {
    expect(parseAction('prompt_button OK|_OK|primary')).toEqual({
      kind: 'button', label: 'OK', gcode: '_OK', style: 'primary'
    })
  })
  it('parses button with defaults', () => {
    expect(parseAction('prompt_button OK')).toEqual({
      kind: 'button', label: 'OK', gcode: 'OK', style: 'secondary'
    })
  })
  it('emits unknown for empty-label button', () => {
    // Empty label means "button ignored" per spec. Parser surfaces this as unknown
    // (reducer no-ops); alternative is emitting nothing, but `unknown` keeps a uniform shape.
    expect(parseAction('prompt_button')).toEqual({ kind: 'unknown', command: 'button' })
    expect(parseAction('prompt_button   ')).toEqual({ kind: 'unknown', command: 'button' })
  })
  it('parses footer_button', () => {
    expect(parseAction('prompt_footer_button Cancel|_CANCEL|secondary')).toEqual({
      kind: 'footer_button', label: 'Cancel', gcode: '_CANCEL', style: 'secondary'
    })
  })
  it('parses target with comma-separated list', () => {
    expect(parseAction('prompt_target fluidd,web')).toEqual({
      kind: 'target', targets: ['fluidd', 'web']
    })
  })
  it('trims target entries and lowercases for compare', () => {
    expect(parseAction('prompt_target  Fluidd , Web ')).toEqual({
      kind: 'target', targets: ['fluidd', 'web']
    })
  })
  it('parses target with single entry', () => {
    expect(parseAction('prompt_target all')).toEqual({ kind: 'target', targets: ['all'] })
  })
  it('parses size', () => {
    expect(parseAction('prompt_size large')).toEqual({ kind: 'size', size: 'large' })
  })
  it('falls back size to normal for invalid value', () => {
    expect(parseAction('prompt_size huge')).toEqual({ kind: 'size', size: 'normal' })
    expect(parseAction('prompt_size')).toEqual({ kind: 'size', size: 'normal' })
    expect(parseAction('prompt_size  ')).toEqual({ kind: 'size', size: 'normal' })
  })
  it('normalizes size case', () => {
    expect(parseAction('prompt_size LARGE')).toEqual({ kind: 'size', size: 'large' })
  })
  it('parses row_start/row_end', () => {
    expect(parseAction('prompt_row_start')).toEqual({ kind: 'row_start' })
    expect(parseAction('prompt_row_end')).toEqual({ kind: 'row_end' })
  })
  it('parses button_group_start/end', () => {
    expect(parseAction('prompt_button_group_start')).toEqual({ kind: 'button_group_start' })
    expect(parseAction('prompt_button_group_end')).toEqual({ kind: 'button_group_end' })
  })
  it('parses image with path, alt, scale', () => {
    expect(parseAction('prompt_image config/spool.svg|Blue PLA|0.75')).toEqual({
      kind: 'image', path: 'config/spool.svg', alt: 'Blue PLA', scale: 0.75
    })
  })
  it('parses image with empty alt + scale', () => {
    expect(parseAction('prompt_image config/spool.svg||0.5')).toEqual({
      kind: 'image', path: 'config/spool.svg', alt: '', scale: 0.5
    })
  })
  it('parses image with only path', () => {
    expect(parseAction('prompt_image config/spool.svg')).toEqual({
      kind: 'image', path: 'config/spool.svg', alt: '', scale: null
    })
  })
  it('parses markup as AST', () => {
    const ev = parseAction('prompt_markup <b>Hi</b>')
    expect(ev?.kind).toBe('markup')
    if (ev?.kind === 'markup') {
      expect(ev.ast).toEqual([
        { type: 'tag', tag: 'b', children: [{ type: 'text', text: 'Hi' }] }
      ])
    }
  })
})

describe('parseAction — unknown commands', () => {
  it('emits unknown for prompt_xyz', () => {
    expect(parseAction('prompt_unknown_thing arg')).toEqual({ kind: 'unknown', command: 'unknown_thing' })
  })
  it('emits unknown for prompt_text_scale (KlipperScreen-local alias)', () => {
    expect(parseAction('prompt_text_scale 1.5')).toEqual({ kind: 'unknown', command: 'text_scale' })
  })
})
