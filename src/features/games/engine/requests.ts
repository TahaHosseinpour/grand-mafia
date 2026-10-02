import { findUnacknowledgedWarningForRealtime } from '@/features/users';
import { sendInProgressGameUpdate } from './updates';
import { sendGameList, sendUserList, updateUserStatus } from './lists';
import { engineStore } from './store';
import type { HubSocket } from './hub';

/** What a player's client asks the engine for (legacy `user-requests.js`). */

/** Send the open lists to a socket that just connected or asked again. */
export function sendGeneralChats(socket: HubSocket): void {
  socket.emit('generalChats', engineStore().generalChats);
}

/**
 * The client wants to look at a table: observers join its room, a seated
 * player who left and came back is seated again.
 */
export function sendGameInfo(socket: HubSocket, uid: unknown): void {
  if (typeof uid !== 'string') return;

  const game = engineStore().games.get(uid);
  if (game?.publicPlayersState && game.general) {
    if (socket.username) {
      const player = game.publicPlayersState.find((seat) => seat.userName === socket.username);
      if (player) {
        player.leftGame = false;
        player.connected = true;
        game.general.timeAbandoned = null;
        socket.emit('updateSeatForUser', true);
        updateUserStatus(socket.username, game);
      } else {
        updateUserStatus(socket.username, game, 'observing');
      }
    }

    socket.join(uid);
    sendInProgressGameUpdate(game);
    socket.emit('joinGameRedirect', game.general.uid);
  } else {
    // No such live game (finished and gone, or a wrong link): the client returns to the lobby.
    socket.emit('manualReplayRequest', '');
  }
}

/** The staff chat of one table: a moderator's own status line. */
export function updateStatusFor(socket: HubSocket, gameId?: string): void {
  if (!socket.username) return;
  const game = gameId ? engineStore().games.get(gameId) : undefined;
  const seated = game?.publicPlayersState.some((player) => player.userName === socket.username);
  updateUserStatus(socket.username, seated ? game : null);
}

export { findUnacknowledgedWarningForRealtime, sendGameList, sendUserList };
