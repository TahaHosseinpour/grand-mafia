import { defineRoute } from '@/server/http';
import { listPostsQuery, listPublishedPosts } from '@/features/posts';

/**
 * A thin route: for a consumer outside React rendering (a mobile app, a
 * `'use client'` page that fetches, a third party). A server component would
 * call `listPublishedPosts` directly instead — server code never fetches its
 * own API.
 *
 * Response: `{ success: true, data: Paged<PostListItemDTO> }`.
 */
export const GET = defineRoute({
  query: listPostsQuery,
  handler: ({ query }) => listPublishedPosts(query),
});
