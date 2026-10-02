import { loadPresenceForRealtime } from '@/features/users';
import { checkStartConditions } from './lobby';
import { sendGameList, updateUserStatus } from './lists';
import { newSeat } from './seats';
import { engineStore, findGame } from './store';
import { sendCommandChatsUpdate } from './updates';
import { joinGameInput } from '../inputs';
import type { HubSocket } from './hub';
import type { Caller } from './types';

/** Is `name` on the creator's blacklist? */
export const isBlacklisted = (name: string, list: unknown[] | null | undefined): boolean =>
  Array.isArray(list) && list.some((entry) => (entry as { userName?: string }).userName === name);

/**
 * A player takes a seat at a table that has not started (legacy
 * `updateSeatedUser`). Every entry condition is checked against fresh data:
 * the table's room, rainbow/private/Elo/XP limits and the creator's blacklist.
 */
export async function handleSeatRequest(socket: HubSocket, caller: Caller, raw: unknown): Promise<void> {
  const parsed = joinGameInput.safeParse(raw);
  if (!parsed.success) return;
  const data = parsed.data;

  const game = findGame(data.uid);
  // A seat cannot be taken once the cards are on the table.
  if (!game || game.gameState.isTracksFlipped) return;

  if (isBlacklisted(caller.username, game.private.gameCreatorBlacklist)) {
    socket.emit('gameJoinStatusUpdate', { status: 'blacklisted' });
    return;
  }

  const account = await loadPresenceForRealtime(caller.username);
  // The table may have changed while the account loaded.
  if (!account || game.gameState.isTracksFlipped) return;

  const isNotMaxedOut = game.publicPlayersState.length < game.general.maxPlayersCount;
  const isNotInGame = !game.publicPlayersState.some((player) => player.userName === caller.username);
  const isRainbowSafe = !game.general.rainbowgame || account.isRainbowOverall;
  const isPrivateSafe =
    !game.general.private || data.password === game.private.privatePassword || game.general.whitelistedPlayers.includes(caller.username);
  const meetsElo = !game.general.eloMinimum || game.general.eloMinimum <= account.eloSeason || game.general.eloMinimum <= account.eloOverall;
  const meetsXp = !game.general.xpMinimum || game.general.xpMinimum <= account.xpOverall;

  if (account.wins + account.losses < 3 && engineStore().flags.limitNewPlayers && !game.general.private) return;

  if (!(isNotMaxedOut && isNotInGame && isRainbowSafe && isPrivateSafe && meetsElo && meetsXp)) return;

  game.publicPlayersState.unshift(newSeat(caller.username, account.gameSettings));

  socket.emit('updateSeatForUser', true);
  checkStartConditions(game);
  updateUserStatus(caller.username, game);
  sendCommandChatsUpdate(game);
  sendGameList();
}
