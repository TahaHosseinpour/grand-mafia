import 'server-only';
import {
  admitConnection,
  checkRestriction,
  getEmoteList,
  sendGameList,
  sendGeneralChats,
  sendUserList,
} from '@/features/games/realtime';
import { APP_VERSION } from '@/lib/version';
import { rootLogger } from '@/server/logger';
import { isFullStaff } from '@/server/staff';
import { hubSocketFor, type GameSocket } from './hub';
import { registerHandlers, type Session } from './handlers';

const log = rootLogger.child({ module: 'realtime' });

/**
 * One new connection: admit it (or turn it away), send the opening lists and
 * register its handlers. Handlers are registered at once, so an event the
 * client sends the moment it connects is not lost; each handler waits for
 * admission to finish before it runs.
 */
export function onConnection(socket: GameSocket): void {
  const hub = hubSocketFor(socket);
  const session: Session = { restricted: true };
  log.debug({ socketId: socket.id, user: hub.username }, 'socket connected');

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
