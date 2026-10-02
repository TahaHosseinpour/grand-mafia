/**
 * Cache tags, in one place.
 *
 * No tag string is ever built by hand at a call site (ESLint enforces it). A
 * `revalidateTag('post')` on the write side and a `cacheTag('posts')` on the
 * read side never meet, and the bug looks like "the admin saved, the site did
 * not change" — which nobody sees until a user reports it.
 *
 * Three shapes:
 *   tags.posts              — a list/catalogue. Any create or delete busts it.
 *   tags.post(slug)         — one item.
 *   tags.userBookmarks(id)  — per-user data, keyed by the user id.
 *
 * A new kind of cached data gets its tag builder here **before** the first
 * `'use cache'` that uses it. No tag, no cache.
 *
 * Key items by whatever both sides can always produce: if the write side only
 * knows the id and the read side only the slug, key by id.
 */
export const tags = {
  // ---- Public content ---------------------------------------------------
  posts: 'posts',
  post: (slug: string) => `post:${slug}`,
  postComments: (postId: number) => `post:${postId}:comments`,

  // ---- Per-user data ----------------------------------------------------
  // Cached under `'use cache'` only when the user id is a function argument
  // (never read from cookies inside the cached function).
  userBookmarks: (userId: number) => `user:${userId}:bookmarks`,
} as const;
