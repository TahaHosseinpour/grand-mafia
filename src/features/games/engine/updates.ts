import { getHub } from './store';
import type { HubSocket } from './hub';
import type { ChatEntry, Game, GameChatLine, SeatedPlayer } from './types';

/**
 * Sending a game's state to the sockets in its room (legacy
 * `routes/socket/util.js`). Every socket gets its own copy: seated players
 * their private view, observers the public one — hidden roles, hands and the
 * deck never reach a client that may not see them.
 */

/** The game without anything the server keeps to itself. */
export function secureGame(game: Game): Omit<Game, 'private' | 'remakeData' | 'guesses' | 'unsentReports'> {
  const copy: Partial<Game> & Record<string, unknown> = { ...game };
  delete copy.private;
  delete copy.remakeData;
  delete copy.guesses;
  delete copy.unsentReports;
  // Not in the legacy list, but it is the same kind of thing: the full log of
  // hands, votes and claims, set once a game completes.
  delete copy.summary;
  return copy as Omit<Game, 'private' | 'remakeData' | 'guesses' | 'unsentReports'>;
}

const seatOf = (game: Game, userName: string): SeatedPlayer | undefined =>
  game.private.seatedPlayers.find((player) => player.userName === userName);

/** Seated players see their own feed; observers (and the pregame lobby) the shared one. */
function combineInProgressChats(game: Game, chats: ChatEntry[], userName?: string | null): ChatEntry[] {
  if (userName && game.gameState.isTracksFlipped) {
    const seat = seatOf(game, userName);
    return (seat?.gameChats ?? []).concat(chats);
  }
  return game.private.unSeatedGameChats.concat(chats);
}

/** Chat lines only that user sees (command replies, «chat is disabled»). */
export function combineCommandChats(game: Game, chats: ChatEntry[], userName: string | null | undefined): ChatEntry[] {
  const own = userName ? game.private.commandChats[userName] : undefined;
  return own ? chats.concat(own) : chats;
}

type Update = Omit<Game, 'private' | 'remakeData' | 'guesses' | 'unsentReports'> & Partial<Pick<Game, 'playersState' | 'cardFlingerState'>>;

/**
 * Sends the current state of a game to everyone in its room.
 * @param noChats the clients keep their chat as it is (the second argument
 *   `true` tells them so).
 */
export function sendInProgressGameUpdate(game: Game | undefined, noChats = false): void {
  if (!game) return;
  const room = getHub().socketsInRoom(game.general.uid);
  if (!room.length) return;

  const seatedNames = game.publicPlayersState.map((player) => player.userName);
  const playerSockets: HubSocket[] = [];
  const observerSockets: HubSocket[] = [];
  for (const socket of room) {
    if (socket.username && seatedNames.includes(socket.username)) playerSockets.push(socket);
    else observerSockets.push(socket);
  }

  for (const socket of playerSockets) {
    const user = socket.username as string;
    const update: Record<string, unknown> = { ...game };

    if (!game.gameState.isCompleted && game.gameState.isTracksFlipped) {
      const privatePlayer = seatOf(game, user);
      if (!privatePlayer) continue;
      update.playersState = privatePlayer.playersState;
      update.cardFlingerState = privatePlayer.cardFlingerState ?? [];
    }

    update.chats = combineCommandChats(game, game.chats, user);
    if (noChats) {
      delete update.chats;
      socket.emit('gameUpdate', secureGame(update as unknown as Game), true);
    } else {
      update.chats = combineInProgressChats(game, update.chats as ChatEntry[], user);
      socket.emit('gameUpdate', secureGame(update as unknown as Game));
    }
  }

  let chatWithHidden: ChatEntry[] = game.chats;
  if (!noChats && game.private.hiddenInfoChat.length && game.private.hiddenInfoSubscriptions.length) {
    chatWithHidden = [...chatWithHidden, ...game.private.hiddenInfoChat];
  }

  for (const socket of observerSockets) {
    const user = socket.username;
    const update: Record<string, unknown> = { ...game };

    if (user && game.private.hiddenInfoSubscriptions.includes(user)) {
      // Staff status is checked when a subscription is added.
      update.chats = chatWithHidden;
    }

    if (noChats) {
      delete update.chats;
      socket.emit('gameUpdate', secureGame(update as unknown as Game), true);
    } else {
      update.chats = combineInProgressChats(game, (update.chats as ChatEntry[] | undefined) ?? game.chats);
      update.chats = combineCommandChats(game, update.chats as ChatEntry[], user);
      socket.emit('gameUpdate', secureGame(update as unknown as Game));
    }
  }
}

/**
 * Moderator-only hidden-information lines. The legacy function was keyed on a
 * property that never exists on a socket, so it never sent anything; staff
 * receive hidden lines inside `gameUpdate` (see above). Kept as a no-op so
 * the engine's call sites stay where the original had them.
 */
export function sendInProgressModChatUpdate(game: Game, chat: GameChatLine | GameChatLine[], specificUser?: string): void {
  void [game, chat, specificUser]; // intentionally nothing
}

/** A new typed message: sent as a single event, not a whole game update. */
export function sendPlayerChatUpdate(game: Game, chat: ChatEntry): void {
  for (const socket of getHub().socketsInRoom(game.general.uid)) socket.emit('playerChatUpdate', chat);
}

/** After a command reply or a lobby change: re-sends the game to signed-in sockets only. */
export function sendCommandChatsUpdate(game: Game): void {
  for (const socket of getHub().socketsInRoom(game.general.uid)) {
    const user = socket.username;
    if (!user) continue;
    const update: Record<string, unknown> = { ...game };
    update.chats = combineCommandChats(game, game.chats, user);
    socket.emit('gameUpdate', secureGame(update as unknown as Game));
  }
}

export type { Update };
