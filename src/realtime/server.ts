import 'server-only';
import type { Server as HttpServer } from 'node:http';
import { Server } from 'socket.io';
import { setHub, startFlagSync, startGarbageCollector, startListBroadcasts } from '@/features/games/realtime';
import { rootLogger } from '@/server/logger';
import { resolveActor } from '@/server/socket-auth';
import { onConnection } from './connection';
import { createHub, type GameServer } from './hub';

/**
 * Socket.IO server: authentication at handshake, then per connection the
 * game's event handlers. The engine runs in this process (live games are in
 * memory), so there is exactly one instance of it.
 */

const log = rootLogger.child({ module: 'realtime' });

export function attachRealtime(server: HttpServer): GameServer {
  const io: GameServer = new Server(server, {
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
        log.error({ err: error }, 'socket handshake failed');
        next(new Error('handshake failed'));
      });
  });

  setHub(createHub(io));
  startListBroadcasts();
  startGarbageCollector();
  startFlagSync();

  io.on('connection', onConnection);
  return io;
}
