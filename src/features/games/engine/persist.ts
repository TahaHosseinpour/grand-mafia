import { CURRENT_SEASON_NUMBER } from '@/lib/game-constants';
import { log } from '@/server/logger';
import type { Serializable } from '@/server/types';
import { saveFinishedGameForEngine } from '../dal';
import { sendGameList } from './lists';
import { engineStore } from './store';
import type { FinishedGameRecord } from '../types';
import type { Game } from './types';

/**
 * Turning the in-memory game into a stored record, and removing finished
 * games from memory (legacy `end-game.js` `generateGameObject`, `saveGame`,
 * `saveAndDeleteGame`).
 */

/** Dates and class instances become plain JSON, as the database stores them. */
const plainObject = (value: unknown): Record<string, Serializable> => plain(value) as Record<string, Serializable>;
const plain = (value: unknown): Serializable => JSON.parse(JSON.stringify(value ?? null)) as Serializable;

export function buildGameRecord(game: Game): FinishedGameRecord {
  const { general } = game;
  const completed = Boolean(game.gameState.isCompleted);
  const seated = game.private.seatedPlayers;

  const winners = completed ? seated.filter((player) => player.wonGame).map((player) => player.userName) : [];
  const losers = completed
    ? seated.filter((player) => !player.wonGame).map((player) => player.userName)
    : game.publicPlayersState.map((player) => player.userName);

  return {
    uid: general.uid,
    name: general.name,
    flag: general.flag ?? null,
    season: CURRENT_SEASON_NUMBER,
    playerCount: general.playerCount ?? game.publicPlayersState.length,
    playerChats: general.playerChats ?? null,
    winningPlayers: winners,
    losingPlayers: losers,
    winningTeam: completed ? (game.gameState.isCompleted as string) : null,
    isRainbow: Boolean(general.rainbowgame),
    eloMinimum: general.eloMinimum ?? null,
    casualGame: Boolean(general.casualGame),
    practiceGame: Boolean(general.practiceGame),
    customGame: Boolean(game.customGameSettings?.enabled),
    unlistedGame: Boolean(general.unlistedGame),
    isVerifiedOnly: Boolean(general.isVerifiedOnly),
    completed,
    settings: plainObject({
      xpMinimum: general.xpMinimum,
      rebalance6p: general.rebalance6p,
      rebalance7p: general.rebalance7p,
      rebalance9p2f: general.rebalance9p2f,
      timedMode: general.timedMode,
      blindMode: general.blindMode,
      avalonSH: general.avalonSH,
      monarchistSH: general.monarchistSH,
      noTopdecking: general.noTopdecking,
      roles: completed ? seated.map((player) => ({ userName: player.userName, team: player.role?.team, role: player.role?.cardName })) : [],
      guesses: Object.fromEntries(Object.entries(game.guesses ?? {}).map(([name, guess]) => [name, guess.toString()])),
      merlinGuesses: game.merlinGuesses ?? {},
    }),
    chats: plain([...game.chats, ...game.private.unSeatedGameChats, ...game.private.replayGameChats]),
    hiddenInfoChat: plain(game.private.hiddenInfoChat),
    summary: completed && !general.private && game.private.summary ? plain(game.private.summary.publish()) : null,
  };
}

/** Stores the game (a no-op for the dev table). Failures are logged, never thrown into the game. */
export async function saveGame(game: Game): Promise<void> {
  try {
    await saveFinishedGameForEngine(buildGameRecord(game));
    if (game.gameState.isCompleted && game.private.summary && !game.general.private) game.summarySaved = true;
  } catch (error) {
    log().error({ err: error, uid: game.general.uid }, 'saving a finished game failed');
  }
}

export async function saveAndDeleteGame(uid: string): Promise<void> {
  const game = engineStore().games.get(uid);
  if (game) await saveGame(game);
  engineStore().games.delete(uid);
  sendGameList();
}
