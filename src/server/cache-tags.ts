/**
 * Cache tags, in one place.
 *
 * No tag string is ever built by hand at a call site (ESLint enforces it). A
 * new kind of cached data gets its tag builder here **before** the first
 * `'use cache'` that uses it. No tag, no cache.
 *
 * Live game state is never cached: it lives in the engine's memory and
 * reaches clients over Socket.IO.
 */
export const tags = {
  // ---- Ranking ----------------------------------------------------------
  leaderboards: 'leaderboards',
  seasonStats: 'season-stats',

  // ---- Users ------------------------------------------------------------
  profile: (username: string) => `profile:${username.toLowerCase()}`,
} as const;
