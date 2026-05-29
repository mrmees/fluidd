export interface SocketState {
  status: SocketStatus;
  acceptingNotifications: boolean;
  connectionId: number | null;
  hasBeenReady: boolean;
}

export type SocketStatus =
  | 'initializing'
  | 'disconnected'
  | 'connecting'
  | 'identifying'
  | 'authenticating'
  | 'ready'

export interface SocketError {
  code: number;
  message: string;
}
