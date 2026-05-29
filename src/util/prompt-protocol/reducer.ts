// src/util/prompt-protocol/reducer.ts
//
// Pure reducer for Klipper Macro Prompt Protocol v1.
// State is replaced on every event — no in-place mutation.
// Containers (row/button_group), targeting, sizing, and disconnect
// are handled in Tasks 12 and 13.

import type {
  PromptDialog,
  PromptDialogFooterButton,
  PromptDialogItem,
  PromptDialogItemButton,
  PromptDialogItemImage,
  PromptDialogItemMarkup,
  PromptDialogItemText,
  PromptStateMachine
} from './types'
import type { ProtocolEvent } from './parse-action'

export interface ReducerOptions {
  frontendId: string
  frontendCategories: string[]
}

export function initialPromptState (): PromptDialog {
  return {
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
  }
}

function freshIdle (machine?: Partial<PromptStateMachine>): PromptDialog {
  const base = initialPromptState()
  if (machine) {
    base.machine = { ...base.machine, ...machine }
  }
  return base
}

function targetsMatch (targets: string[], opts: ReducerOptions): boolean {
  if (targets.includes('all')) return true
  if (targets.includes(opts.frontendId.toLowerCase())) return true
  for (const category of opts.frontendCategories) {
    if (targets.includes(category.toLowerCase())) return true
  }
  return false
}

function beginPrompt (
  prev: PromptDialog,
  title: string,
  opts: ReducerOptions
): PromptDialog {
  const activeTargets = prev.machine.pendingTargets ?? ['all']
  const matched = targetsMatch(activeTargets, opts)
  const size = prev.machine.pendingSize ?? 'normal'

  return {
    open: false,
    title,
    size,
    items: [],
    footerButtons: [],
    machine: {
      lifecycle: matched ? 'building' : 'suppressed',
      activeContainer: null,
      activeTargets,
      pendingTargets: null,
      pendingSize: null,
      // Session-monotonic IDs: preserve counter across prompt boundaries.
      nextItemId: prev.machine.nextItemId
    }
  }
}

function appendItem (state: PromptDialog, item: Omit<PromptDialogItem, 'id'>): PromptDialog {
  const id = state.machine.nextItemId
  const withId = { ...item, id } as PromptDialogItem
  return {
    ...state,
    items: [...state.items, withId],
    machine: { ...state.machine, nextItemId: id + 1 }
  }
}

function appendFooterButton (
  state: PromptDialog,
  button: Omit<PromptDialogFooterButton, 'id'>
): PromptDialog {
  const id = state.machine.nextItemId
  return {
    ...state,
    footerButtons: [...state.footerButtons, { ...button, id }],
    machine: { ...state.machine, nextItemId: id + 1 }
  }
}

export function reducePrompt (
  state: PromptDialog,
  event: ProtocolEvent,
  opts: ReducerOptions
): PromptDialog {
  // Targeting / sizing / disconnect handled in Task 13.
  switch (event.kind) {
    case 'begin':
      return beginPrompt(state, event.title, opts)

    case 'unknown':
      return state

    case 'show':
      if (state.machine.lifecycle === 'building') {
        return { ...state, open: true, machine: { ...state.machine, lifecycle: 'shown' } }
      }
      return state

    case 'end':
      if (state.machine.lifecycle === 'idle') return state
      return freshIdle({ nextItemId: state.machine.nextItemId })
  }

  // Content commands below — only valid in building or shown states.
  const lc = state.machine.lifecycle
  if (lc === 'idle' || lc === 'suppressed') return state

  switch (event.kind) {
    case 'text':
      return appendItem(state, { type: 'text', text: event.text } as Omit<PromptDialogItemText, 'id'>)

    case 'markup':
      return appendItem(state, { type: 'markup', ast: event.ast } as Omit<PromptDialogItemMarkup, 'id'>)

    case 'image': {
      const item: Omit<PromptDialogItemImage, 'id'> = {
        type: 'image', path: event.path, alt: event.alt, scale: event.scale
      }
      return appendItem(state, item)
    }

    case 'button':
      return appendItem(state, {
        type: 'button', label: event.label, gcode: event.gcode, style: event.style
      } as Omit<PromptDialogItemButton, 'id'>)

    case 'footer_button':
      return appendFooterButton(state, {
        label: event.label, gcode: event.gcode, style: event.style
      })
  }

  // row/group/target/size/disconnect handled in Tasks 12 and 13.
  return state
}
