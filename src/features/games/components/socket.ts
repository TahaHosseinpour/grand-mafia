import { io, type Socket } from 'socket.io-client';

/**
 * The one Socket.IO connection of the game client. The session cookie rides
 * along with the handshake (same origin); the server knows who we are from
 * it, so no event ever says who is sending.
 */

let socket: Socket | null = null;

export function getSocket(): Socket {
  socket ??= io({ transports: ['websocket', 'polling'], autoConnect: false });
  return socket;
}

/** Sends an event to the server. A no-op before the client has connected once. */
export function emit(event: string, ...args: unknown[]): void {
  getSocket().emit(event, ...args);
}
