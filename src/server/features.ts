/**
 * The frozen list of feature domains. Each gets `src/features/<name>/`.
 *
 * A new domain is a change to this array, agreed first — not a new folder.
 * `FeatureName` derives from it, so a directory not on the list has no valid
 * name.
 */
export const FEATURES = [
  // Sign-up, sign-in/out, email verification, password reset.
  'auth',
  // Accounts: identity, game settings, bio, colours, account page.
  'users',
  // The game: in-memory engine, lobby, seats, game chat, finished-game records.
  'games',
  // The lobby-wide general chat.
  'chat',
  // Staff tools: bans, timeouts, reports, mod DMs, mod log, signups.
  'moderation',
  // ELO, XP, seasons, leaderboards, badges, profile statistics.
  'ranking',
  // Custom cardbacks, emotes, Flappy Hitler.
  'cosmetics',
] as const;

export type FeatureName = (typeof FEATURES)[number];

/**
 * The dependency graph: which feature may import which, through its barrel.
 *
 * **Not enforced by tooling.** It stays true only if the PR that adds an
 * import edge adds it here too, with a comment saying *why*.
 */
export const FEATURE_LAYERS: Record<FeatureName, readonly FeatureName[]> = {
  // Sign-up creates the account row; sign-in reads it. Both check IP bans
  // and write the signups log moderators review.
  auth: ['users', 'moderation'],
  users: [],
  // A finished game updates ranking (ELO, XP, badges, profile stats); seats
  // read players' settings and moderation state (bans, timeouts).
  games: ['users', 'ranking', 'moderation'],
  // Chat respects timeouts/bans and shows users' colours.
  chat: ['users', 'moderation'],
  // Moderators act on accounts.
  moderation: ['users'],
  // Leaderboards and badges are computed over accounts.
  ranking: ['users'],
  // Cardbacks are stored per account.
  cosmetics: ['users'],
};
