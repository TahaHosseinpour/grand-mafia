/**
 * Application paths, built in one place.
 *
 * A path typed as a literal at 40 call sites cannot be changed, and every
 * public URL is also an SEO asset carried by `sitemap.ts` and redirects.
 * Build links with these: `href={routes.post(slug)}`.
 *
 * Admin paths are not here: their canonical list is `ADMIN_PAGE_PATHS` in
 * `@/lib/admin-pages`, because permission rows are keyed on those strings.
 */
export const routes = {
  home: '/',

  posts: '/posts',
  post: (slug: string) => `/posts/${slug}`,

  login: '/login',
  signup: '/signup',

  dashboard: '/dashboard',
  profile: '/dashboard/profile',
} as const;

/** Absolute URL for emails, SMS, payment callbacks, sitemap and Open Graph. */
export function absoluteUrl(path: string, baseUrl: string): string {
  return `${baseUrl}${path.startsWith('/') ? path : `/${path}`}`;
}
