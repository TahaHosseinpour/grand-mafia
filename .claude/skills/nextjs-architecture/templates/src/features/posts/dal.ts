import 'server-only';
import { cacheLife, cacheTag, revalidateTag } from 'next/cache';
import { Prisma } from '@prisma/client';
import { prisma } from '@/server/db';
import { getSession, requireAdminPermission, requireUserId } from '@/server/auth';
import { ConflictError, NotFoundError } from '@/server/errors';
import { EVENTS, logEvent } from '@/server/events';
import { tags } from '@/server/cache-tags';
import { paged, type Paged } from '@/server/types';
import type {
  AddCommentInput,
  CreatePostInput,
  DeleteCommentInput,
  ListPostsForAdminQuery,
  ListPostsQuery,
  UpdatePostInput,
} from './inputs';
import type {
  AdminPostDTO,
  AdminPostListItemDTO,
  PostCommentDTO,
  PostDTO,
  PostListItemDTO,
  PostStatsDTO,
} from './types';

/**
 * The posts data access layer — the reference dal.
 *
 * The only file in the feature that touches the database. What it shows:
 *
 * - **Identity inside the dal.** Every write opens with `requireUserId()` or
 *   `requireAdminPermission(page, 'full')`. A Server Component, an action, a
 *   route and a cron job can all reach a dal function; only the dal is on
 *   every path.
 * - **Explicit `select` + mapper**, never a returned or spread row: a spread
 *   ships every future column to the browser.
 * - **Dates become ISO strings** in the DTO.
 * - **Parent-scoped child writes**: a comment is deleted by `{ id, postId,
 *   userId }`, never by `id` alone.
 * - **Invalidation beside the write**, so a second caller cannot forget it.
 * - **Public reads cached, per-viewer reads live.**
 * - Naming: `get<X>` throws NotFound, `find<X>` returns null, `list<X>s`
 *   returns `Paged<T>`, `…ForAdmin` is the privileged variant.
 */

const POSTS_PAGE = '/admin/posts' as const;

/* -------------------------------------------------------------------------- */
/*  Selects and mappers                                                        */
/* -------------------------------------------------------------------------- */

const postListSelect = {
  id: true,
  title: true,
  slug: true,
  excerpt: true,
  publishedAt: true,
} satisfies Prisma.PostSelect;

const postDetailSelect = {
  ...postListSelect,
  body: true,
  updatedAt: true,
} satisfies Prisma.PostSelect;

const commentSelect = {
  id: true,
  body: true,
  createdAt: true,
  userId: true,
} satisfies Prisma.PostCommentSelect;

const adminPostListSelect = {
  id: true,
  title: true,
  slug: true,
  status: true,
  publishAt: true,
  publishedAt: true,
  createdAt: true,
  _count: { select: { comments: true } },
} satisfies Prisma.PostSelect;

const adminPostDetailSelect = {
  ...adminPostListSelect,
  excerpt: true,
  body: true,
  updatedAt: true,
} satisfies Prisma.PostSelect;

const iso = (date: Date | null) => date?.toISOString() ?? null;

function toListItem(row: Prisma.PostGetPayload<{ select: typeof postListSelect }>): PostListItemDTO {
  return {
    id: row.id,
    title: row.title,
    slug: row.slug,
    excerpt: row.excerpt,
    publishedAt: iso(row.publishedAt),
  };
}

function toPost(row: Prisma.PostGetPayload<{ select: typeof postDetailSelect }>): PostDTO {
  return { ...toListItem(row), body: row.body, updatedAt: row.updatedAt.toISOString() };
}

function toComment(
  row: Prisma.PostCommentGetPayload<{ select: typeof commentSelect }>,
  viewerId: number | undefined
): PostCommentDTO {
  // `userId` is selected to compute `isMine` and is not sent to the client.
  return { id: row.id, body: row.body, createdAt: row.createdAt.toISOString(), isMine: row.userId === viewerId };
}

function toAdminListItem(
  row: Prisma.PostGetPayload<{ select: typeof adminPostListSelect }>
): AdminPostListItemDTO {
  return {
    id: row.id,
    title: row.title,
    slug: row.slug,
    status: row.status,
    publishAt: iso(row.publishAt),
    publishedAt: iso(row.publishedAt),
    createdAt: row.createdAt.toISOString(),
    commentCount: row._count.comments,
  };
}

function toAdminPost(row: Prisma.PostGetPayload<{ select: typeof adminPostDetailSelect }>): AdminPostDTO {
  return {
    ...toAdminListItem(row),
    excerpt: row.excerpt,
    body: row.body,
    updatedAt: row.updatedAt.toISOString(),
  };
}

/** Every write that changes what the public sees calls this. */
function invalidatePosts(...slugs: (string | null | undefined)[]): void {
  revalidateTag(tags.posts, 'max');
  for (const slug of slugs) if (slug) revalidateTag(tags.post(slug), 'max');
}

/** A unique-constraint violation becomes a 409 with a reason, not a 500. */
function isUniqueViolation(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002';
}

/* -------------------------------------------------------------------------- */
/*  Public reads — cached                                                      */
/* -------------------------------------------------------------------------- */

/**
 * Public and identical for every visitor, so cached. The `query` argument is
 * part of the cache key. Admin writes revalidate `tags.posts`; the profile is
 * only a backstop.
 */
export async function listPublishedPosts(query: ListPostsQuery): Promise<Paged<PostListItemDTO>> {
  'use cache';
  cacheLife('catalog');
  cacheTag(tags.posts);

  const where: Prisma.PostWhereInput = {
    status: 'published',
    ...(query.search ? { title: { contains: query.search, mode: 'insensitive' } } : {}),
  };

  const [rows, total] = await Promise.all([
    prisma.post.findMany({
      where,
      orderBy: { publishedAt: 'desc' },
      skip: (query.page - 1) * query.limit,
      take: query.limit,
      select: postListSelect,
    }),
    prisma.post.count({ where }),
  ]);

  return paged(rows.map(toListItem), total, query.page, query.limit);
}

/**
 * `find`, not `get`: returns null instead of throwing. A throw inside a
 * `'use cache'` function is a prerender error that a caller's try/catch
 * never sees — so the cached half answers null and the page calls
 * `notFound()`. (Caching an empty result is fine here: the tag is revalidated
 * when the post is published.)
 */
export async function findPublishedPostBySlug(slug: string): Promise<PostDTO | null> {
  'use cache';
  cacheLife('detail');
  cacheTag(tags.post(slug));

  const row = await prisma.post.findFirst({
    where: { slug, status: 'published' },
    select: postDetailSelect,
  });
  return row ? toPost(row) : null;
}

/* -------------------------------------------------------------------------- */
/*  Per-viewer reads — live                                                    */
/* -------------------------------------------------------------------------- */

/**
 * Not cached: `isMine` depends on who is asking, and a session read
 * (`cookies()`) can never sit inside `'use cache'`. The page renders this
 * under `<Suspense>`. Scoped to the parent's visibility — the comments of a
 * draft are not readable by guessing its id.
 */
export async function listPostComments(postId: number): Promise<PostCommentDTO[]> {
  const session = await getSession();
  const rows = await prisma.postComment.findMany({
    where: { postId, post: { status: 'published' } },
    orderBy: { createdAt: 'desc' },
    take: 100,
    select: commentSelect,
  });
  return rows.map((row) => toComment(row, session?.userId));
}

/* -------------------------------------------------------------------------- */
/*  User writes                                                                */
/* -------------------------------------------------------------------------- */

/**
 * Comments are read live, so there is no cache tag to invalidate; the form
 * calls `router.refresh()` after a successful action.
 */
export async function addComment(input: AddCommentInput): Promise<PostCommentDTO> {
  // Identity from the session — never from the input.
  const userId = await requireUserId();

  // The id names a *thing*; check the thing is one the caller may touch.
  const post = await prisma.post.findFirst({
    where: { id: input.postId, status: 'published' },
    select: { id: true },
  });
  if (!post) throw new NotFoundError('مطلب یافت نشد');

  const row = await prisma.postComment.create({
    data: { postId: post.id, userId, body: input.body },
    select: commentSelect,
  });
  return toComment(row, userId);
}

/** Scoped to parent **and** owner: all three ids in one `where`. */
export async function deleteOwnComment(input: DeleteCommentInput): Promise<void> {
  const userId = await requireUserId();

  const { count } = await prisma.postComment.deleteMany({
    where: { id: input.commentId, postId: input.postId, userId },
  });
  if (count === 0) throw new NotFoundError('نظر یافت نشد');
}

/* -------------------------------------------------------------------------- */
/*  Admin                                                                      */
/* -------------------------------------------------------------------------- */

export async function listPostsForAdmin(query: ListPostsForAdminQuery): Promise<Paged<AdminPostListItemDTO>> {
  await requireAdminPermission(POSTS_PAGE, 'read');

  const where: Prisma.PostWhereInput = {
    ...(query.status ? { status: query.status } : {}),
    ...(query.search ? { title: { contains: query.search, mode: 'insensitive' } } : {}),
  };

  const [rows, total] = await Promise.all([
    prisma.post.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (query.page - 1) * query.limit,
      take: query.limit,
      select: adminPostListSelect,
    }),
    prisma.post.count({ where }),
  ]);

  return paged(rows.map(toAdminListItem), total, query.page, query.limit);
}

export async function getPostForAdmin(id: number): Promise<AdminPostDTO> {
  await requireAdminPermission(POSTS_PAGE, 'read');

  const row = await prisma.post.findUnique({ where: { id }, select: adminPostDetailSelect });
  if (!row) throw new NotFoundError('مطلب یافت نشد');
  return toAdminPost(row);
}

export async function createPostForAdmin(input: CreatePostInput): Promise<AdminPostDTO> {
  await requireAdminPermission(POSTS_PAGE, 'full');

  let row;
  try {
    // `input` is the output of a hand-written schema, so spreading it is
    // safe. Spreading a database *row* into a DTO is what is forbidden.
    row = await prisma.post.create({
      data: { ...input, publishedAt: input.status === 'published' ? new Date() : null },
      select: adminPostDetailSelect,
    });
  } catch (error) {
    if (isUniqueViolation(error)) throw new ConflictError('این اسلاگ قبلاً استفاده شده است');
    throw error;
  }

  if (row.status === 'published') logEvent(EVENTS.CONTENT_PUBLISHED, { postId: row.id });
  invalidatePosts(row.slug);
  return toAdminPost(row);
}

export async function updatePostForAdmin(id: number, input: UpdatePostInput): Promise<AdminPostDTO> {
  await requireAdminPermission(POSTS_PAGE, 'full');

  const before = await prisma.post.findUnique({ where: { id }, select: { slug: true, status: true } });
  if (!before) throw new NotFoundError('مطلب یافت نشد');

  const becomesPublished = input.status === 'published' && before.status !== 'published';

  let row;
  try {
    row = await prisma.post.update({
      where: { id },
      data: { ...input, ...(becomesPublished ? { publishedAt: new Date() } : {}) },
      select: adminPostDetailSelect,
    });
  } catch (error) {
    if (isUniqueViolation(error)) throw new ConflictError('این اسلاگ قبلاً استفاده شده است');
    throw error;
  }

  if (becomesPublished) logEvent(EVENTS.CONTENT_PUBLISHED, { postId: id });
  // Both slugs: the old URL must stop serving the cached page after a rename.
  invalidatePosts(before.slug, row.slug);
  return toAdminPost(row);
}

export async function deletePostForAdmin(id: number): Promise<void> {
  await requireAdminPermission(POSTS_PAGE, 'full');

  const before = await prisma.post.findUnique({ where: { id }, select: { slug: true } });
  if (!before) throw new NotFoundError('مطلب یافت نشد');

  // Comments go with it through `onDelete: Cascade`. Where a required relation
  // would block the delete instead, throw ConflictError with the reason.
  await prisma.post.delete({ where: { id } });

  logEvent(EVENTS.CONTENT_DELETED, { postId: id });
  invalidatePosts(before.slug);
}

/** The admin dashboard asks each feature for its own numbers; `admin` reads no tables. */
export async function getPostStatsForDashboard(): Promise<PostStatsDTO> {
  await requireAdminPermission('/admin/dashboard', 'read');

  const [published, drafts, comments] = await Promise.all([
    prisma.post.count({ where: { status: 'published' } }),
    prisma.post.count({ where: { status: 'draft' } }),
    prisma.postComment.count(),
  ]);
  return { published, drafts, comments };
}

/* -------------------------------------------------------------------------- */
/*  System — reachable only through `system.ts`, i.e. from cron routes          */
/* -------------------------------------------------------------------------- */

/**
 * Acts for the platform, not for a caller, so it resolves no identity — the
 * one sanctioned kind of write without a `require*`. That is safe only
 * because `index.ts` does not export it: `system.ts` re-exports it, and lint
 * allows that subpath from `src/app/api/cron/**` alone.
 */
export async function publishScheduledPosts(): Promise<{ published: number }> {
  const due = await prisma.post.findMany({
    where: { status: 'draft', publishAt: { lte: new Date() } },
    select: { id: true, slug: true },
  });
  if (due.length === 0) return { published: 0 };

  await prisma.post.updateMany({
    // `status: 'draft'` again: a post an admin changed meanwhile is left alone.
    where: { id: { in: due.map((post) => post.id) }, status: 'draft' },
    data: { status: 'published', publishedAt: new Date() },
  });

  for (const post of due) logEvent(EVENTS.CONTENT_PUBLISHED, { postId: post.id, scheduled: true });
  invalidatePosts(...due.map((post) => post.slug));
  return { published: due.length };
}
