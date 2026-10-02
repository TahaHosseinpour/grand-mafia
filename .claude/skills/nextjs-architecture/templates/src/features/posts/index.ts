/**
 * The posts feature's server entry point — `@/features/posts`.
 *
 * Everything outside the feature imports from here (or from `./client`) and
 * nowhere else; deep imports are a lint error. What is not exported is
 * private and can change without touching a caller.
 *
 * Named exports only — no `export *`, so the public surface is a list a
 * reviewer can read.
 *
 * Deliberately absent: system functions (`publishScheduledPosts`). They live
 * behind `./system`, which only cron routes may import — exporting them here
 * would give every caller a write that checks no identity.
 *
 * `'use client'` files must NOT import values from here: this barrel
 * re-exports `dal.ts` (`server-only` + Prisma). They import `./client`, and
 * types from here with `import type` on its own line.
 */

export {
  // Public
  listPublishedPosts,
  findPublishedPostBySlug,
  listPostComments,
  addComment,
  deleteOwnComment,
  // Admin
  listPostsForAdmin,
  getPostForAdmin,
  createPostForAdmin,
  updatePostForAdmin,
  deletePostForAdmin,
  getPostStatsForDashboard,
} from './dal';

export {
  addCommentAction,
  deleteCommentAction,
  listPostsAdminAction,
  createPostAction,
  updatePostAction,
  deletePostAction,
} from './actions';

export {
  listPostsQuery,
  listPostsForAdminQuery,
  addCommentInput,
  deleteCommentInput,
  createPostInput,
  updatePostInput,
} from './inputs';

export type {
  ListPostsQuery,
  ListPostsForAdminQuery,
  AddCommentInput,
  DeleteCommentInput,
  CreatePostInput,
  UpdatePostInput,
} from './inputs';

export type {
  PostListItemDTO,
  PostDTO,
  PostCommentDTO,
  AdminPostListItemDTO,
  AdminPostDTO,
  PostStatsDTO,
} from './types';
