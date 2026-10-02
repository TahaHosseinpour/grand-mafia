import type { ChatEntry, ChatPart, ChatPartType, Game, GameChatLine, SeatedPlayer } from './types';

/**
 * Builders for the game's own chat lines. A line is a list of parts; a part
 * is plain text or text with a `type` the client colours (a player, a team, a
 * role). Persian text goes in as ordinary strings — the structure is the
 * legacy one, which the client renders.
 */

export type Part = string | ChatPart;

const toPart = (part: Part): ChatPart => (typeof part === 'string' ? { text: part } : part);

export function line(...parts: Part[]): GameChatLine {
  return { gameChat: true, timestamp: new Date(), chat: parts.map(toPart) };
}

/** A coloured part: `typed('liberal', 'لیبرال')`. */
export const typed = (type: ChatPartType, text: string): ChatPart => ({ text, type });

/** A player/seat mention, e.g. «علی {3}», or just «{3}» in blind games. */
export function seatTag(game: Game, seat: number, seated: SeatedPlayer[] = game.private.seatedPlayers): ChatPart {
  const text = game.general.blindMode ? `{${seat + 1}}` : `${seated[seat].userName} {${seat + 1}}`;
  return { text, type: 'player' };
}

/** A mention that always names the player (moderator-only lines). */
export function namedSeatTag(game: Game, seat: number): ChatPart {
  return { text: `${game.private.seatedPlayers[seat].userName} {${seat + 1}}`, type: 'player' };
}

/** «B» / «R» for a policy, coloured by its team (moderator-only lines). */
export const policyLetter = (policy: 'liberal' | 'fascist'): ChatPart => ({
  text: policy === 'liberal' ? 'B' : 'R',
  type: policy,
});

/** Pushes a line to every seat and to the observers' feed. */
export function tellAll(game: Game, entry: GameChatLine): void {
  for (const player of game.private.seatedPlayers) player.gameChats.push(entry);
  game.private.unSeatedGameChats.push(entry);
}

/** Pushes a line to every seat except `except`, and to the observers' feed. */
export function tellOthers(game: Game, entry: GameChatLine, ...except: SeatedPlayer[]): void {
  for (const player of game.private.seatedPlayers) {
    if (!except.includes(player)) player.gameChats.push(entry);
  }
  game.private.unSeatedGameChats.push(entry);
}

/** The same, but only when the game has its event chat enabled. */
export function tellAllUnlessSilent(game: Game, entry: GameChatLine): void {
  if (!game.general.disableGamechat) tellAll(game, entry);
}

export function isGameChat(entry: ChatEntry): entry is GameChatLine {
  return (entry as GameChatLine).chat !== undefined && typeof (entry as GameChatLine).chat !== 'string';
}
