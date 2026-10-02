/**
 * The posts feature's client entry point — `@/features/posts/client`.
 *
 * Separate from `index.ts` on purpose. A barrel is one module: importing one
 * component from it evaluates the whole file, so components exported beside
 * `dal.ts` would drag `server-only` and all of Prisma into every client
 * bundle — a build error that **only `next build` shows** (not tsc, not lint).
 *
 * Forwarding the actions is safe: `actions.ts` is a `'use server'` module, so
 * the bundler replaces it with client reference stubs.
 *
 *   'use client';
 *   import { CommentForm, addCommentAction } from '@/features/posts/client';
 *   import type { PostDTO } from '@/features/posts';   // types only, own line
 */

export { default as PostList } from './components/post-list';
export { default as CommentForm } from './components/comment-form';

export { addCommentAction, deleteCommentAction, listPostsAdminAction, createPostAction, updatePostAction, deletePostAction } from './actions';
