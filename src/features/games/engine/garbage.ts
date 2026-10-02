import { engineStore } from './store';
import { saveAndDeleteGame } from './persist';

/**
 * Removes games nobody needs any more: two minutes after a game is over, or
 * after everyone left it (legacy `gamesGarbageCollector`). A game a moderator
 * is holding with a delete delay stays until they release it.
 */

const GRACE_MS = 2 * 60 * 1000;
const SWEEP_INTERVAL_MS = 30 * 1000;

export function collectGames(now: number = Date.now()): void {
  const { games, hub } = engineStore();

  for (const [uid, game] of games) {
    const completedAt = game.gameState?.isCompleted && game.gameState.timeCompleted ? game.gameState.timeCompleted + GRACE_MS : null;
    const abandonedAt = game.general?.timeAbandoned ? game.general.timeAbandoned.getTime() + GRACE_MS : null;

    const expired = (!game.general.modDeleteDelay && completedAt !== null && completedAt < now) || (abandonedAt !== null && abandonedAt < now);
    if (!expired || !game.publicPlayersState) continue;

    // Send the players still here back to the lobby before the table disappears.
    for (const seat of game.publicPlayersState) {
      const socket = hub.allSockets().find((candidate) => candidate.username === seat.userName);
      socket?.emit('toLobby', uid);
      socket?.leave(uid);
    }
    void saveAndDeleteGame(uid);
  }
}

let started = false;

/** Starts the periodic sweep. Idempotent; the timer never keeps the process alive. */
export function startGarbageCollector(): void {
  if (started) return;
  started = true;
  setInterval(() => collectGames(), SWEEP_INTERVAL_MS).unref();
}
