/**
 * Application paths, built in one place.
 *
 * These are the legacy URLs, unchanged: `/game` hosts the game client (its
 * screens are hash routes: `/game#/table/<uid>`, `/game#/profile/<name>`…).
 */
export const routes = {
  home: '/',
  game: '/game',
  observe: '/observe',
  rules: '/rules',
  howToPlay: '/how-to-play',
  stats: '/stats',
  changelog: '/changelog',
  tou: '/tou',
  about: '/about',
  account: '/account',
  resetPassword: '/reset-password',
  verifyAccount: '/verify-account',

  // Hash routes inside the game client.
  table: (uid: string) => `/game#/table/${uid}`,
  profile: (username: string) => `/game#/profile/${username}`,
} as const;

/** Absolute URL for emails and Open Graph. */
export function absoluteUrl(path: string, baseUrl: string): string {
  return `${baseUrl}${path.startsWith('/') ? path : `/${path}`}`;
}
