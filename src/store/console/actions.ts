import type { ActionTree } from 'vuex'
import { Globals } from '@/globals'
import type { ConsoleEntry, ConsoleFilter, ConsoleState } from './types'
import type { RootState } from '../types'
import { SocketActions } from '@/api/socketActions'
import DOMPurify from 'dompurify'
import { parseAction, reducePrompt, initialPromptState } from '@/util/prompt-protocol'
import type { ProtocolEvent } from '@/util/prompt-protocol'

const REDUCER_OPTS = { frontendId: 'fluidd', frontendCategories: ['web'] }

export const actions = {
  /**
   * Reset our store
   */
  async reset ({ commit, state }) {
    if (state.promptDialog.machine.lifecycle !== 'idle') {
      const cleared = reducePrompt(state.promptDialog, { kind: 'disconnect' }, REDUCER_OPTS)
      commit('setPromptDialog', cleared)
    }
    commit('setReset')
  },

  /**
   * Inits known command history
   */
  async initConsole ({ commit }, payload) {
    commit('setInitConsole', payload)
  },

  /**
   * Add a command history item, and update server store.
   */
  async onUpdateCommandHistory ({ state, commit }, payload) {
    commit('setUpdateCommandHistory', payload)
    SocketActions.serverDatabasePostItem(Globals.MOONRAKER_DB.fluidd.ROOTS.console.name + '.commandHistory', state.commandHistory)
  },

  /**
   * The result of a specific gcode request.
   */
  async onGcodeScript ({ dispatch }, payload) {
    // If the response is not ok, pass it to the console.
    if (payload && payload.result && payload.result !== 'ok') {
      dispatch('onAddConsoleEntry', { message: Globals.CONSOLE_RECEIVE_PREFIX + payload.result })
    }
  },

  /**
   * Add a console entry
   */
  async onAddConsoleEntry ({ commit, dispatch }, payload: Omit<ConsoleEntry, 'id'>) {
    const rawMessage = payload.message
    const sanitized = DOMPurify.sanitize(rawMessage).replace(/\r\n|\r|\n/g, '<br />')
    if (!payload.time || payload.time <= 0) {
      payload.time = Date.now() / 1000 | 0
    }
    if (!payload.type) {
      payload.type = 'response'
    }
    if (payload.type === 'response' && rawMessage.startsWith('// action:')) {
      payload.type = 'action'
    }

    commit('setConsoleEntry', { ...payload, message: sanitized })

    // Hand RAW (unsanitized) line to the prompt parser; sanitization corrupts markup entities.
    dispatch('onUpdatePromptDialog', { rawMessage })
  },

  /**
   * On a fresh load of the UI, we load prior gcode / console history
   */
  async onGcodeStore ({ commit }, payload: Moonraker.DataStore.GcodeStoreResponse) {
    if (payload && payload.gcode_store) {
      const entries = payload.gcode_store.map((entry, index): ConsoleEntry => {
        const rawMessage = Globals.CONSOLE_RECEIVE_PREFIX + entry.message
        const message = DOMPurify.sanitize(rawMessage).replace(/\r\n|\r|\n/g, '<br />')
        const type = (
          entry.type === 'response' &&
          entry.message.startsWith('// action:')
        ) ? 'action' : entry.type
        return { ...entry, id: index, message, type }
      })

      commit('setAllEntries', entries)

      // Replay all action:prompt_* events through the reducer in one pass.
      let promptState = initialPromptState()
      for (let i = 0; i < payload.gcode_store.length; i++) {
        const raw = Globals.CONSOLE_RECEIVE_PREFIX + payload.gcode_store[i].message
        if (!raw.includes('action:prompt_')) continue
        const event: ProtocolEvent | null = parseAction(raw)
        if (event) promptState = reducePrompt(promptState, event, REDUCER_OPTS)
      }
      commit('setPromptDialog', promptState)
    }
  },

  async onUpdatePromptDialog ({ state, commit }, payload: { rawMessage: string }) {
    const event = parseAction(payload.rawMessage)
    if (!event) return
    const next = reducePrompt(state.promptDialog, event, REDUCER_OPTS)
    commit('setPromptDialog', next)
  },

  /**
   * Klipper provides us with a list of available gcode commands
   * based on the current configuration.
   */
  async onGcodeHelp ({ commit }, payload: Moonraker.KlippyApis.GcodeHelpResponse) {
    commit('setGcodeHelp', payload)
  },

  /**
   * Updates auto scroll value
   */
  async onUpdateAutoScroll ({ commit }, payload) {
    commit('setAutoScroll', payload)
    SocketActions.serverDatabasePostItem(Globals.MOONRAKER_DB.fluidd.ROOTS.console.name + '.autoScroll', payload)
  },

  /**
   * Remove a filter
   */
  async onRemoveFilter ({ commit, state }, filter: ConsoleFilter) {
    commit('setRemoveFilter', filter)
    SocketActions.serverDatabasePostItem(Globals.MOONRAKER_DB.fluidd.ROOTS.console.name + '.consoleFilters', state.consoleFilters)
  },

  /**
    * Add/Edit a filter
    */
  async onSaveFilter ({ commit, state }, filter: ConsoleFilter) {
    commit('setFilter', filter)
    SocketActions.serverDatabasePostItem(Globals.MOONRAKER_DB.fluidd.ROOTS.console.name + '.consoleFilters', state.consoleFilters)
  },

  async onClear ({ commit, state }) {
    commit('setLastCleared')
    SocketActions.serverDatabasePostItem(Globals.MOONRAKER_DB.fluidd.ROOTS.console.name + '.lastCleared', state.lastCleared)
  }
} satisfies ActionTree<ConsoleState, RootState>
