import type { NextConfig } from 'next';
// import { withSentryConfig } from '@sentry/nextjs';

const nextConfig: NextConfig = {
  // Self-hosted Docker/Node deploys. (pino-pretty as a transport breaks here —
  // see src/server/logger.ts.)
  output: 'standalone',
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
  //  Named for *what the data is*, not for a duration, so retuning a number
  //  never renames call sites.
  //
  //  Thresholds: `revalidate: 0` or `expire` < 5 min drops that subtree out
  //  of the prerender (a request-time hole); `stale` < 30 s drops it too.
  //  `userData` and `volatile` sit on those floors on purpose.
  // ─────────────────────────────────────────────────────────────────────
  cacheComponents: true,

  cacheLife: {
    // Marketing copy; changes when someone edits a page.
    marketing: { stale: 3600, revalidate: 3600, expire: 86400 },
    // Public listings. Admin writes revalidate tags; the timer is a backstop.
    catalog: { stale: 300, revalidate: 300, expire: 3600 },
    // One public item's page (post, product, landing).
    detail: { stale: 3600, revalidate: 900, expire: 86400 },
    // Per-user data cached under a userId-keyed tag. Short: being wrong shows
    // the user their own stale state.
    userData: { stale: 60, revalidate: 60, expire: 300 },
    // Counters. Never money, progress or anything judged — cache nothing there.
    volatile: { stale: 30, revalidate: 15, expire: 300 },
  },

  // No `env: { BASE_URL }` block: it inlines the value at build time and a
  // standalone image then serves the old URL forever. Read env at runtime.

  images: {
    remotePatterns: [
      // { protocol: 'https', hostname: 'storage.example.com', pathname: '/**' },
    ],
  },

  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          // Only if every route is HTTPS-only.
          { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
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

// With Sentry:
// export default withSentryConfig(nextConfig, {
//   org: '<org>',
//   project: '<project>',
//   silent: !process.env.CI,
//   widenClientFileUpload: true,
//   sourcemaps: { deleteSourcemapsAfterUpload: true },
//   disableLogger: true,
// });
