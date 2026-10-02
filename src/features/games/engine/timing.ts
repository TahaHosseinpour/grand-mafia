import type { Game } from './types';

/**
 * Animation and pacing delays. The legacy engine paced every step of a turn
 * with `setTimeout`s: normal players see the cards move, "experienced" mode
 * trims the waits, and development runs near-instantly.
 */

const isDevelopment = () => process.env.NODE_ENV === 'development';

/** `normal` ms, `experienced` ms in experienced-mode games, 100 ms in development. */
export function pace(game: Game, normal: number, experienced: number = normal): number {
  if (isDevelopment()) return 100;
  return game.general.experiencedMode ? experienced : normal;
}

/** For waits the legacy code did not shorten in development. */
export function paceKeepDev(game: Game, normal: number, experienced: number = normal): number {
  return game.general.experiencedMode ? experienced : normal;
}

/** Plain fixed delay, shortened in development like the legacy `dev ? 100 : n`. */
export function fast(ms: number): number {
  return isDevelopment() ? 100 : ms;
}

/** How long a timed-mode player has to act. */
export function timedModeMs(game: Game): number {
  const override = process.env.DEVTIMEDDELAY;
  if (override) return Number(override);
  return (game.general.timedMode || 0) * 1000;
}
