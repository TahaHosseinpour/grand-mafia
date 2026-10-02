'use server';

import { defineAction, defineAdminAction } from '@/server/action';
import {
  addComment,
  createPostForAdmin,
  deleteOwnComment,
  deletePostForAdmin,
  listPostsForAdmin,
  updatePostForAdmin,
} from './dal';
import {
  addCommentInput,
  createPostInput,
  deleteCommentInput,
  deletePostActionInput,
  listPostsForAdminQuery,
  updatePostActionInput,
} from './inputs';

/**
 * Posts Server Actions — thin: validate (schema), filter (auth, rate limit),
 * call one dal function. No queries and no logic here.
 *
 * Why separate from `dal.ts`: every export of a `'use server'` file is a
 * public HTTP endpoint. A helper exported from a merged file would be
 * callable from any browser. `dal.ts` is `server-only` and never exposed.
 *
 * The dal checks identity again; declaring it in both places is correct and
 * costs one cached lookup.
 */

/* ---- User -------------------------------------------------------------- */

export const addCommentAction = defineAction({
  name: 'posts.addComment',
  input: addCommentInput,
  rateLimit: 'COMMENT',
  handler: (input) => addComment(input),
});

export const deleteCommentAction = defineAction({
  name: 'posts.deleteComment',
  input: deleteCommentInput,
  handler: async (input) => {
    await deleteOwnComment(input);
    return { id: input.commentId };
  },
});

/* ---- Admin ------------------------------------------------------------- */

// `access` defaults to 'full'; list actions say 'read' explicitly.
export const listPostsAdminAction = defineAdminAction({
  name: 'posts.listForAdmin',
  page: '/admin/posts',
  access: 'read',
  input: listPostsForAdminQuery,
  handler: (query) => listPostsForAdmin(query),
});

export const createPostAction = defineAdminAction({
  name: 'posts.create',
  page: '/admin/posts',
  input: createPostInput,
  handler: (input) => createPostForAdmin(input),
});

export const updatePostAction = defineAdminAction({
  name: 'posts.update',
  page: '/admin/posts',
  input: updatePostActionInput,
  handler: ({ id, data }) => updatePostForAdmin(id, data),
});

export const deletePostAction = defineAdminAction({
  name: 'posts.delete',
  page: '/admin/posts',
  input: deletePostActionInput,
  handler: async ({ id }) => {
    await deletePostForAdmin(id);
    return { id };
  },
});
