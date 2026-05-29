// src/util/prompt-protocol/reducer.ts
//
// Pure reducer for Klipper Macro Prompt Protocol v1.
// State is replaced on every event — no in-place mutation.
// Containers (row/button_group), targeting, sizing, and disconnect
// are handled in Tasks 12 and 13.

import type {
  PromptDialog,
  PromptDialogFooterButton,
  PromptDialogInlineItem,
  PromptDialogItem,
  PromptDialogItemButton,
  PromptDialogItemImage,
  PromptDialogItemMarkup,
  PromptDialogItemText,
  PromptStateMachine
} from './types'
import type { ProtocolEvent } from './parse-action'
import { isValidImagePath } from './image-path'

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
      // Idle state is "visible to all" — matches spec expectation after prompt_end.
      activeTargets: ['all'],
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

function ensureContainerInItems (state: PromptDialog): PromptDialog {
  const pending = state.machine.pendingContainer
  if (!pending) return state
  // Already flushed to items if the last item's id matches the pending container's id.
  const last = state.items[state.items.length - 1]
  if (last && last.id === pending.id) return state
  // First child — flush the container shell into items.
  return { ...state, items: [...state.items, pending] }
}

function appendInRow (state: PromptDialog, item: Omit<PromptDialogInlineItem, 'id'>): PromptDialog {
  const flushed = ensureContainerInItems(state)
  const id = flushed.machine.nextItemId
  const newItem = { ...item, id } as PromptDialogInlineItem
  const items = flushed.items.map((existing, idx) => {
    if (idx !== flushed.items.length - 1) return existing
    if (existing.type !== 'row') return existing
    return { ...existing, items: [...existing.items, newItem] }
  })
  const updatedContainer = items[items.length - 1]
  return {
    ...flushed,
    items,
    machine: {
      ...flushed.machine,
      nextItemId: id + 1,
      pendingContainer: updatedContainer
    }
  }
}

function appendInGroup (state: PromptDialog, button: Omit<PromptDialogItemButton, 'id'>): PromptDialog {
  const flushed = ensureContainerInItems(state)
  const id = flushed.machine.nextItemId
  const items = flushed.items.map((existing, idx) => {
    if (idx !== flushed.items.length - 1) return existing
    if (existing.type !== 'button_group') return existing
    return { ...existing, buttons: [...existing.buttons, { ...button, id }] }
  })
  const updatedContainer = items[items.length - 1]
  return {
    ...flushed,
    items,
    machine: {
      ...flushed.machine,
      nextItemId: id + 1,
      pendingContainer: updatedContainer
    }
  }
}

function appendTopLevel (state: PromptDialog, item: Omit<PromptDialogItem, 'id'>): PromptDialog {
  const id = state.machine.nextItemId
  return {
    ...state,
    items: [...state.items, { ...item, id } as PromptDialogItem],
    machine: { ...state.machine, nextItemId: id + 1 }
  }
}

function appendContent (state: PromptDialog, item: Omit<PromptDialogItem, 'id'>): PromptDialog {
  const container = state.machine.activeContainer
  if (container === 'row') {
    // Spec: rows can contain inline items only (text, markup, image, button).
    if (item.type === 'row' || item.type === 'button_group') return state
    return appendInRow(state, item as Omit<PromptDialogInlineItem, 'id'>)
  }
  if (container === 'button_group') {
    // Spec: groups contain content buttons only.
    if (item.type !== 'button') return state
    return appendInGroup(state, item as Omit<PromptDialogItemButton, 'id'>)
  }
  return appendTopLevel(state, item)
}

function openContainer (state: PromptDialog, kind: 'row' | 'button_group'): PromptDialog {
  // Nested start: advance id (tombstone for ID stability) but otherwise ignore.
  if (state.machine.activeContainer !== null) {
    return { ...state, machine: { ...state.machine, nextItemId: state.machine.nextItemId + 1 } }
  }
  const id = state.machine.nextItemId
  const pendingContainer: PromptDialogItem = kind === 'row'
    ? { id, type: 'row', items: [] }
    : { id, type: 'button_group', buttons: [] }
  return {
    ...state,
    machine: {
      ...state.machine,
      activeContainer: kind,
      nextItemId: id + 1,
      pendingContainer
    }
  }
}

function closeContainer (state: PromptDialog, kind: 'row' | 'button_group'): PromptDialog {
  if (state.machine.activeContainer !== kind) return state
  // Flush pending container to items (handles empty-container case).
  const pending = state.machine.pendingContainer
  const last = state.items[state.items.length - 1]
  const alreadyFlushed = pending && last && last.id === pending.id
  const newItems = (!alreadyFlushed && pending) ? [...state.items, pending] : state.items
  return {
    ...state,
    items: newItems,
    machine: { ...state.machine, pendingContainer: undefined, activeContainer: null }
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
  switch (event.kind) {
    case 'target':
      return { ...state, machine: { ...state.machine, pendingTargets: event.targets } }
    case 'size':
      return { ...state, machine: { ...state.machine, pendingSize: event.size } }
    case 'disconnect':
      if (state.machine.lifecycle === 'idle') return state
      return freshIdle({ nextItemId: state.machine.nextItemId })
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

  const lc = state.machine.lifecycle
  if (lc === 'idle' || lc === 'suppressed') return state

  switch (event.kind) {
    case 'text':
      return appendContent(state, { type: 'text', text: event.text } as Omit<PromptDialogItemText, 'id'>)
    case 'markup':
      return appendContent(state, { type: 'markup', raw: event.raw, ast: event.ast } as Omit<PromptDialogItemMarkup, 'id'>)
    case 'image': {
      if (isValidImagePath(event.path)) {
        return appendContent(state, { type: 'image', path: event.path, alt: event.alt, scale: event.scale } as Omit<PromptDialogItemImage, 'id'>)
      }
      // Fallback: invalid path → text item using alt, or drop if alt is empty.
      if (event.alt.length === 0) return state
      return appendContent(state, { type: 'text', text: event.alt } as Omit<PromptDialogItemText, 'id'>)
    }
    case 'button':
      return appendContent(state, { type: 'button', label: event.label, gcode: event.gcode, style: event.style } as Omit<PromptDialogItemButton, 'id'>)
    case 'footer_button':
      return appendFooterButton(state, { label: event.label, gcode: event.gcode, style: event.style })
    case 'row_start':
      return openContainer(state, 'row')
    case 'row_end':
      return closeContainer(state, 'row')
    case 'button_group_start':
      return openContainer(state, 'button_group')
    case 'button_group_end':
      return closeContainer(state, 'button_group')
  }

  return state
}
