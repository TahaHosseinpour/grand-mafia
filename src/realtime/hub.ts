import 'server-only';
import type { Server, Socket } from 'socket.io';
import type { Hub, HubSocket } from '@/features/games/realtime';
import type { Actor } from '@/server/socket-auth';

/**
 * The Socket.IO side of the engine's `Hub` interface: the engine sees
 * `HubSocket`s and room broadcasts, never Socket.IO itself.
 */

type EventHandlers = Record<string, (...args: unknown[]) => void>;
export type SocketData = { actor: Actor | null };
export type GameSocket = Socket<EventHandlers, EventHandlers, Record<string, never>, SocketData>;
export type GameServer = Server<EventHandlers, EventHandlers, Record<string, never>, SocketData>;

const adapters = new WeakMap<GameSocket, HubSocket>();

export function hubSocketFor(socket: GameSocket): HubSocket {
  let adapter = adapters.get(socket);
  if (!adapter) {
    adapter = {
      id: socket.id,
      username: socket.data.actor?.username ?? null,
      staffRole: socket.data.actor?.staffRole ?? null,
      emit: (event, ...args) => {
        socket.emit(event, ...args);
      },
      join: (room) => {
        void socket.join(room);
      },
      leave: (room) => {
        void socket.leave(room);
      },
      leaveAllRooms: () => {
        for (const room of socket.rooms) if (room !== socket.id) void socket.leave(room);
      },
      disconnect: () => {
        socket.disconnect(true);
      },
    };
    adapters.set(socket, adapter);
  }
  return adapter;
}

export function createHub(io: GameServer): Hub {
  const adapt = (sockets: Iterable<GameSocket>): HubSocket[] => [...sockets].map(hubSocketFor);

  return {
    allSockets: () => adapt(io.sockets.sockets.values()),
    socketsInRoom: (room) => {
      const ids = io.sockets.adapter.rooms.get(room);
      if (!ids) return [];
      return adapt([...ids].flatMap((id) => io.sockets.sockets.get(id) ?? []));
    },
    emitAll: (event, ...args) => {
      io.emit(event, ...args);
    },
    emitRoom: (room, event, ...args) => {
      io.to(room).emit(event, ...args);
    },
  };
}
