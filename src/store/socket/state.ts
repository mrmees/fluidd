import type { SocketState } from './types'

export const defaultState = (): SocketState => {
  return {
    status: 'initializing',
    acceptingNotifications: false,
    connectionId: null,
    hasBeenReady: false
  }
}

export const state = defaultState()
