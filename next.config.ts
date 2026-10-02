import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // No `output: 'standalone'`: the app runs under a custom server (server.ts)
  // that hosts Next and Socket.IO in one process, which needs the full `next`
  // package rather than the standalone server.
  reactStrictMode: true,

  // The baseline is zero tsc errors; keep it that way.
  typescript: { ignoreBuildErrors: false },

  // ─────────────────────────────────────────────────────────────────────
  //  Cache Components + every cache duration in the app.
  //
  //  Code only ever names a profile: `cacheLife('catalog')`. An inline
  //  `cacheLife({ … })` is a lint error, so no number hides elsewhere.
  //
  //    stale      seconds the *client* reuses its copy without asking
  //    revalidate seconds after which the next request triggers a background
  //               refresh (the stale copy is served meanwhile)
  //    expire     seconds without traffic after which the next request waits
  //               for fresh data. Must be greater than `revalidate`.
  //
  //  Live game state is never cached — it lives in the engine's memory and
  //  reaches clients over Socket.IO.
  // ─────────────────────────────────────────────────────────────────────
  cacheComponents: true,

  cacheLife: {
    // Static copy: rules, how-to-play, terms, about, changelog.
    marketing: { stale: 3600, revalidate: 3600, expire: 86400 },
    // Leaderboards and season statistics; finished games revalidate the tag.
    catalog: { stale: 300, revalidate: 300, expire: 3600 },
    // One player's public profile.
    detail: { stale: 60, revalidate: 60, expire: 3600 },
  },

  // No `env: { BASE_URL }` block: it inlines the value at build time. Read
  // env at runtime through `@/server/env`.

  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), interest-cohort=()' },
        ],
      },
    ];
  },
};

export default nextConfig;
