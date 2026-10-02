import 'server-only';
import type { Server as HttpServer } from 'node:http';
import { Server } from 'socket.io';
import {
  admitConnection,
  checkRestriction,
  getEmoteList,
  sendGameList,
  sendGeneralChats,
  sendUserList,
  setHub,
  startFlagSync,
  startGarbageCollector,
  startListBroadcasts,
} from '@/features/games/realtime';
import { APP_VERSION } from '@/lib/version';
import { rootLogger } from '@/server/logger';
import { isFullStaff } from '@/server/staff';
import { resolveActor } from '@/server/socket-auth';
import { createHub, hubSocketFor, type GameServer, type GameSocket } from './hub';
import { registerHandlers, type Session } from './handlers';

/**
 * Socket.IO server: authentication at handshake, then per connection the
 * game's event handlers. The engine runs in this process (live games are in
 * memory), so there is exactly one instance of it.
 */

const log = rootLogger.child({ module: 'realtime' });

function onConnection(socket: GameSocket): void {
  const hub = hubSocketFor(socket);
  const session: Session = { restricted: true };
  log.debug({ socketId: socket.id, user: hub.username }, 'socket connected');

  // Handlers are registered at once so no early event is lost; each waits for
  // this to finish (the connection may still be refused).
  const ready = (async () => {
    if (!(await admitConnection(hub))) return false;

    hub.emit('version', { current: APP_VERSION });
    sendGeneralChats(hub);
    sendGameList(hub, isFullStaff(hub.staffRole));
    sendUserList(hub);
    hub.emit('emoteList', getEmoteList());
    session.restricted = await checkRestriction(hub);
    return true;
  })().catch((error: unknown) => {
    log.error({ err: error, socketId: socket.id }, 'admitting a connection failed');
    return false;
  });

  registerHandlers(socket, hub, session, ready);
}

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
