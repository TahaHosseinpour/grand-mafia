import { PostStatus } from '@/lib/prisma-enums';
import { z, zId, zNullableDate, zNullableText, zPagination, zSearch, zSlug, zText } from '@/lib/validation';

/**
 * Validation schemas for the posts feature.
 *
 * `z` comes from `@/lib/validation` (project locale), never from `zod`.
 * Enums come from `@/lib/prisma-enums`, never as values from `@prisma/client`
 * — this file is reachable from client forms.
 *
 * Written by hand, field by field, never derived from the Prisma model: a
 * derived schema accepts every column, including the ones a client must
 * never set. Every field here maps to a real column; a field the form sends
 * that is missing here is stripped and silently never saved.
 */

/* ---- Public ------------------------------------------------------------ */

export const listPostsQuery = zPagination(12).extend({ search: zSearch });
export type ListPostsQuery = z.infer<typeof listPostsQuery>;

export const addCommentInput = z.object({
  postId: zId,
  body: zText('متن نظر', { max: 2000 }),
});
export type AddCommentInput = z.infer<typeof addCommentInput>;

/** Both ids: the comment must belong to that post (parent-scoped write). */
export const deleteCommentInput = z.object({ postId: zId, commentId: zId });
export type DeleteCommentInput = z.infer<typeof deleteCommentInput>;

/* ---- Admin ------------------------------------------------------------- */

export const listPostsForAdminQuery = zPagination(20).extend({
  search: zSearch,
  status: z.enum(PostStatus).optional(),
});
export type ListPostsForAdminQuery = z.infer<typeof listPostsForAdminQuery>;

// Limits mirror the columns: title VarChar(200), excerpt VarChar(500).
const postFields = {
  title: zText('عنوان', { max: 200 }),
  slug: zSlug,
  excerpt: zNullableText('خلاصه', { max: 500 }),
  body: zText('متن', { max: 200_000 }),
  status: z.enum(PostStatus, 'وضعیت انتشار نامعتبر است'),
  publishAt: zNullableDate,
};

export const createPostInput = z.object({ ...postFields, status: postFields.status.default('draft') });
export type CreatePostInput = z.infer<typeof createPostInput>;

/** `.partial()`: the edit form sends only the fields it touched. */
export const updatePostInput = z.object(postFields).partial();
export type UpdatePostInput = z.infer<typeof updatePostInput>;

/*
 * A Server Action takes one argument, so the id travels with the body as
 * `{ id, data }` — the dal keeps receiving the same update shape, and the id
 * cannot be mistaken for a column.
 */
export const updatePostActionInput = z.object({ id: zId, data: updatePostInput });
export const deletePostActionInput = z.object({ id: zId });
