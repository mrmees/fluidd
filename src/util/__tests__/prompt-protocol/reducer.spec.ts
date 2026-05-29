// src/util/__tests__/prompt-protocol/reducer.spec.ts
import { initialPromptState, reducePrompt } from '@/util/prompt-protocol/reducer'
import type { ProtocolEvent } from '@/util/prompt-protocol/parse-action'
import type { PromptDialog } from '@/util/prompt-protocol/types'

const OPTS = { frontendId: 'fluidd', frontendCategories: ['web'] }

function feed (state: PromptDialog, ...events: ProtocolEvent[]): PromptDialog {
  return events.reduce((s, e) => reducePrompt(s, e, OPTS), state)
}

describe('initialPromptState', () => {
  it('returns a fully shaped idle state', () => {
    expect(initialPromptState()).toEqual({
      open: false,
      title: '',
      size: 'normal',
      items: [],
      footerButtons: [],
      machine: {
        lifecycle: 'idle',
        activeContainer: null,
        activeTargets: [],
        pendingTargets: null,
        pendingSize: null,
        nextItemId: 0
      }
    })
  })
})

describe('reducer — idle state', () => {
  it('ignores content commands while idle', () => {
    const state = feed(initialPromptState(),
      { kind: 'text', text: 'orphan' },
      { kind: 'button', label: 'X', gcode: 'X', style: 'primary' }
    )
    expect(state.items).toEqual([])
    expect(state.machine.lifecycle).toBe('idle')
  })

  it('show before begin is no-op', () => {
    const state = reducePrompt(initialPromptState(), { kind: 'show' }, OPTS)
    expect(state.open).toBe(false)
    expect(state.machine.lifecycle).toBe('idle')
  })

  it('end before begin is no-op', () => {
    const state = reducePrompt(initialPromptState(), { kind: 'end' }, OPTS)
    expect(state.open).toBe(false)
  })

  it('begin transitions to building and sets title', () => {
    const state = reducePrompt(initialPromptState(), { kind: 'begin', title: 'Hi' }, OPTS)
    expect(state.machine.lifecycle).toBe('building')
    expect(state.title).toBe('Hi')
    expect(state.open).toBe(false)
    expect(state.machine.activeTargets).toEqual(['all'])
  })
})

describe('reducer — building state', () => {
  function building (): PromptDialog {
    return reducePrompt(initialPromptState(), { kind: 'begin', title: 'T' }, OPTS)
  }

  it('appends text items with monotonic ids', () => {
    const state = feed(building(),
      { kind: 'text', text: 'a' },
      { kind: 'text', text: 'b' }
    )
    expect(state.items).toEqual([
      { id: 0, type: 'text', text: 'a' },
      { id: 1, type: 'text', text: 'b' }
    ])
    expect(state.machine.nextItemId).toBe(2)
  })

  it('appends button items', () => {
    const state = feed(building(),
      { kind: 'button', label: 'OK', gcode: '_OK', style: 'primary' }
    )
    expect(state.items[0]).toEqual({ id: 0, type: 'button', label: 'OK', gcode: '_OK', style: 'primary' })
  })

  it('appends footer buttons to footerButtons, not items', () => {
    const state = feed(building(),
      { kind: 'footer_button', label: 'Cancel', gcode: '_CANCEL', style: 'secondary' }
    )
    expect(state.items).toEqual([])
    expect(state.footerButtons).toEqual([
      { id: 0, label: 'Cancel', gcode: '_CANCEL', style: 'secondary' }
    ])
  })

  it('show transitions to shown and opens dialog', () => {
    const state = feed(building(), { kind: 'show' })
    expect(state.machine.lifecycle).toBe('shown')
    expect(state.open).toBe(true)
  })

  it('end clears to idle', () => {
    const state = feed(building(), { kind: 'text', text: 'a' }, { kind: 'end' })
    expect(state.machine.lifecycle).toBe('idle')
    expect(state.title).toBe('')
    expect(state.items).toEqual([])
    expect(state.open).toBe(false)
  })

  it('begin during building restarts with new title', () => {
    const state = feed(building(),
      { kind: 'text', text: 'old' },
      { kind: 'begin', title: 'New' }
    )
    expect(state.title).toBe('New')
    expect(state.items).toEqual([])
    expect(state.machine.lifecycle).toBe('building')
  })
})

describe('reducer — shown state', () => {
  function shown (): PromptDialog {
    return feed(initialPromptState(),
      { kind: 'begin', title: 'T' },
      { kind: 'show' }
    )
  }

  it('appends content live after show', () => {
    const state = feed(shown(), { kind: 'text', text: 'live' })
    expect(state.items).toEqual([{ id: 0, type: 'text', text: 'live' }])
    expect(state.open).toBe(true)
  })

  it('show while shown is no-op', () => {
    const initial = shown()
    const state = reducePrompt(initial, { kind: 'show' }, OPTS)
    expect(state).toEqual(initial)
  })

  it('end while shown clears and closes', () => {
    const state = feed(shown(), { kind: 'text', text: 'x' }, { kind: 'end' })
    expect(state.open).toBe(false)
    expect(state.machine.lifecycle).toBe('idle')
    expect(state.items).toEqual([])
  })

  it('begin while shown restarts (clears + reopens at building)', () => {
    const state = feed(shown(),
      { kind: 'text', text: 'old' },
      { kind: 'begin', title: 'New' }
    )
    expect(state.title).toBe('New')
    expect(state.items).toEqual([])
    expect(state.machine.lifecycle).toBe('building')
    expect(state.open).toBe(false)
  })

  it('unknown event is no-op', () => {
    const initial = shown()
    const state = reducePrompt(initial, { kind: 'unknown', command: 'whatever' }, OPTS)
    expect(state).toEqual(initial)
  })
})

describe('reducer — rows', () => {
  function building (): PromptDialog {
    return reducePrompt(initialPromptState(), { kind: 'begin', title: 'T' }, OPTS)
  }

  it('opens a row container', () => {
    const state = feed(building(), { kind: 'row_start' })
    expect(state.machine.activeContainer).toBe('row')
    expect(state.items).toEqual([])
  })

  it('routes content into the open row', () => {
    const state = feed(building(),
      { kind: 'row_start' },
      { kind: 'text', text: 'a' },
      { kind: 'text', text: 'b' }
    )
    expect(state.items).toHaveLength(1)
    expect(state.items[0].type).toBe('row')
    if (state.items[0].type === 'row') {
      expect(state.items[0].items).toEqual([
        { id: 1, type: 'text', text: 'a' },
        { id: 2, type: 'text', text: 'b' }
      ])
    }
  })

  it('closes the row on row_end', () => {
    const state = feed(building(),
      { kind: 'row_start' },
      { kind: 'text', text: 'in' },
      { kind: 'row_end' },
      { kind: 'text', text: 'out' }
    )
    expect(state.machine.activeContainer).toBeNull()
    expect(state.items).toHaveLength(2)
    expect(state.items[1]).toEqual({ id: 2, type: 'text', text: 'out' })
  })

  it('ignores nested row_start', () => {
    const state = feed(building(),
      { kind: 'row_start' },
      { kind: 'row_start' },  // ignored
      { kind: 'text', text: 'x' }
    )
    expect(state.machine.activeContainer).toBe('row')
    expect(state.items[0].type).toBe('row')
    if (state.items[0].type === 'row') {
      expect(state.items[0].items).toEqual([{ id: 2, type: 'text', text: 'x' }])
    }
  })

  it('routes footer_button to footerButtons even inside a row', () => {
    const state = feed(building(),
      { kind: 'row_start' },
      { kind: 'footer_button', label: 'Cancel', gcode: '_CANCEL', style: 'secondary' }
    )
    expect(state.footerButtons).toHaveLength(1)
    if (state.items[0]?.type === 'row') {
      expect(state.items[0].items).toEqual([])
    }
  })

  it('end while row open implicitly closes container', () => {
    const state = feed(building(),
      { kind: 'row_start' },
      { kind: 'text', text: 'x' },
      { kind: 'end' }
    )
    expect(state.machine.activeContainer).toBeNull()
  })
})

describe('reducer — button groups', () => {
  function building (): PromptDialog {
    return reducePrompt(initialPromptState(), { kind: 'begin', title: 'T' }, OPTS)
  }

  it('opens a button group container', () => {
    const state = feed(building(), { kind: 'button_group_start' })
    expect(state.machine.activeContainer).toBe('button_group')
  })

  it('routes buttons into the open group', () => {
    const state = feed(building(),
      { kind: 'button_group_start' },
      { kind: 'button', label: '+1', gcode: '_PLUS1', style: 'secondary' },
      { kind: 'button', label: '-1', gcode: '_MINUS1', style: 'secondary' }
    )
    expect(state.items).toHaveLength(1)
    if (state.items[0].type === 'button_group') {
      expect(state.items[0].buttons).toEqual([
        { id: 1, type: 'button', label: '+1', gcode: '_PLUS1', style: 'secondary' },
        { id: 2, type: 'button', label: '-1', gcode: '_MINUS1', style: 'secondary' }
      ])
    }
  })

  it('drops non-button content inside button group (spec: groups contain buttons only)', () => {
    const state = feed(building(),
      { kind: 'button_group_start' },
      { kind: 'text', text: 'oops' },
      { kind: 'button', label: 'OK', gcode: 'OK', style: 'primary' }
    )
    if (state.items[0].type === 'button_group') {
      expect(state.items[0].buttons).toEqual([
        { id: 1, type: 'button', label: 'OK', gcode: 'OK', style: 'primary' }
      ])
    }
  })

  it('ignores nested button_group_start', () => {
    const state = feed(building(),
      { kind: 'button_group_start' },
      { kind: 'button_group_start' },
      { kind: 'button', label: 'OK', gcode: 'OK', style: 'primary' }
    )
    expect(state.machine.activeContainer).toBe('button_group')
  })

  it('ignores row_start inside button_group (and vice versa)', () => {
    const state = feed(building(),
      { kind: 'button_group_start' },
      { kind: 'row_start' },
      { kind: 'button', label: 'OK', gcode: 'OK', style: 'primary' }
    )
    expect(state.machine.activeContainer).toBe('button_group')
    if (state.items[0].type === 'button_group') {
      expect(state.items[0].buttons).toHaveLength(1)
    }
  })

  it('closes on button_group_end', () => {
    const state = feed(building(),
      { kind: 'button_group_start' },
      { kind: 'button_group_end' },
      { kind: 'text', text: 'after' }
    )
    expect(state.machine.activeContainer).toBeNull()
    expect(state.items).toHaveLength(2)
  })
})
