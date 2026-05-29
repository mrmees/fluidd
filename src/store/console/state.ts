import type { ConsoleState, PromptDialog } from './types'

function initialPromptDialog (): PromptDialog {
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

export const defaultState = (): ConsoleState => {
  return {
    consoleCommand: '',
    consoleSearch: '',
    consoleEntryCount: 0,
    console: [],
    gcodeHelp: {},
    commandHistory: [],
    autoScroll: true,
    lastCleared: 0,
    promptDialog: initialPromptDialog(),
    consoleFilters: [],
    consoleFiltersRegexp: []
  }
}

export const state = defaultState()
