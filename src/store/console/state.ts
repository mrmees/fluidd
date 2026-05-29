import { initialPromptState } from '@/util/prompt-protocol'
import type { ConsoleState } from './types'

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
    promptDialog: initialPromptState(),
    consoleFilters: [],
    consoleFiltersRegexp: [],
    hasReplayedGcodeStore: false
  }
}

export const state = defaultState()
