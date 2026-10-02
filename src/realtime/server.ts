import 'server-only';
import type { Server as HttpServer } from 'node:http';
import { Server } from 'socket.io';
import { rootLogger } from '@/server/logger';
import { resolveActor, type Actor } from '@/server/socket-auth';

/**
 * Socket.IO server: authentication at handshake, then the game's event
 * handlers (registered per connection).
 */

export type SocketData = { actor: Actor | null };

export function attachRealtime(server: HttpServer): Server {
  const io = new Server<Record<string, never>, Record<string, never>, Record<string, never>, SocketData>(server, {
    // Next's HMR socket shares this HTTP server; engine.io must not destroy
    // upgrade requests that are not its own.
    destroyUpgrade: false,
    serveClient: false,
  });

  io.use((socket, next) => {
    resolveActor(socket.handshake.headers.cookie)
      .then((actor) => {
        socket.data.actor = actor;
        next();
      })
      .catch((error: unknown) => {
        rootLogger.error({ err: error }, 'socket handshake failed');
        next(new Error('handshake failed'));
      });
  });

  io.on('connection', (socket) => {
    rootLogger.debug({ socketId: socket.id, user: socket.data.actor?.username ?? null }, 'socket connected');
  });

  return io;
}
