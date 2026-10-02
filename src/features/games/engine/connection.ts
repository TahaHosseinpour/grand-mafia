import { loadPresenceForRealtime } from '@/features/users';
import { getIpBanStatus } from '@/features/moderation';
import { rootLogger } from '@/server/logger';
import { sendInProgressGameUpdate } from './updates';
import { sendUserList } from './lists';
import { engineStore } from './store';
import type { HubSocket } from './hub';

/**
 * What happens when a signed-in player's socket connects (legacy
 * `checkUserStatus`): an older connection of theirs is closed, a seated
 * player of a running game is put back at the table, and a banned or timed-out
 * account is turned away.
 */

const log = rootLogger.child({ module: 'engine.connection' });

/** IP-ban kinds that do not stop an existing account from playing. */
const HARMLESS_BAN_TYPES = new Set(['new', 'fragbanSmall', 'fragbanLarge']);

/** Closes every other connection of the same player: one browser tab at a time. */
function closeOlderConnections(socket: HubSocket): void {
  if (!socket.username) return;
  for (const other of engineStore().hub.allSockets()) {
    if (other.username === socket.username && other.id !== socket.id) {
      other.emit('manualDisconnection');
      other.disconnect();
    }
  }
}

/** Puts a player whose game is running back in it, as connected. */
function rejoinRunningGame(socket: HubSocket): void {
  const game = [...engineStore().games.values()].find((candidate) =>
    candidate.publicPlayersState.some((player) => player.userName === socket.username && !player.leftGame)
  );
  const seat = game?.publicPlayersState.find((player) => player.userName === socket.username);
  if (game && seat && game.gameState.isStarted && !game.gameState.isCompleted) {
    seat.connected = true;
    socket.join(game.general.uid);
    socket.emit('updateSeatForUser');
    sendInProgressGameUpdate(game);
  }
}

/**
 * Runs on every new connection. Returns false when the socket was refused (it
 * has already been told and disconnected); the caller registers no handlers.
 */
export async function admitConnection(socket: HubSocket): Promise<boolean> {
  if (!socket.username) return true;

  closeOlderConnections(socket);
  rejoinRunningGame(socket);

  const refuse = () => {
    const { userList } = engineStore();
    const index = userList.findIndex((user) => user.userName === socket.username);
    if (index >= 0) userList.splice(index, 1);
    socket.emit('manualDisconnection');
    socket.disconnect();
    return false;
  };

  try {
    const account = await loadPresenceForRealtime(socket.username);
    if (!account) return true;

    if (account.isBanned || (account.timeoutUntil && Date.now() < Date.parse(account.timeoutUntil))) return refuse();

    const ban = account.lastConnectedIp ? await getIpBanStatus(account.lastConnectedIp) : null;
    if (ban && !HARMLESS_BAN_TYPES.has(ban.type) && !account.gameSettings.ignoreIPBans) return refuse();

    sendUserList();
    return true;
  } catch (error) {
    log.error({ err: error, user: socket.username }, 'checking a connection failed');
    return true;
  }
}
