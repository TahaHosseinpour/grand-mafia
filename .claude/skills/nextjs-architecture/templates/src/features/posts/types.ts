import type { PostStatus } from '@prisma/client';
import type { Serializable } from '@/server/types';

/**
 * The posts feature's data shapes — the contract with every caller.
 *
 * Separate from `dal.ts` because `dal.ts` is `server-only` and client
 * components need these types. A types module has no runtime half to import
 * by mistake. Client components type their props with these DTOs, never with
 * a hand-written parallel interface that drifts.
 *
 * Rules: `type` aliases (never `interface`), `Date` → ISO `string`,
 * `Decimal` → `number`, nothing from `Prisma.`. Admin and public shapes are
 * separate types, never one type with optional admin-only fields.
 */

export type PostListItemDTO = {
  id: number;
  title: string;
  slug: string;
  excerpt: string | null;
  publishedAt: string | null;
};

/** A published post as the public page renders it. */
export type PostDTO = PostListItemDTO & {
  body: string;
  /** For `dateModified` in JSON-LD. */
  updatedAt: string;
};

export type PostCommentDTO = {
  id: number;
  body: string;
  createdAt: string;
  /** Lets the UI show "delete" on the viewer's own comments. */
  isMine: boolean;
};

export type AdminPostListItemDTO = {
  id: number;
  title: string;
  slug: string;
  status: PostStatus;
  publishAt: string | null;
  publishedAt: string | null;
  createdAt: string;
  commentCount: number;
};

export type AdminPostDTO = AdminPostListItemDTO & {
  excerpt: string | null;
  body: string;
  updatedAt: string;
};

export type PostStatsDTO = {
  published: number;
  drafts: number;
  comments: number;
};

/**
 * The plain-data check: a `Date` or `Decimal` slipping into a DTO is a
 * compile error here, not a runtime break in a client component.
 */
type AssertSerializable<T extends Serializable> = T;

type _PlainDataChecks = [
  AssertSerializable<PostListItemDTO>,
  AssertSerializable<PostDTO>,
  AssertSerializable<PostCommentDTO>,
  AssertSerializable<AdminPostListItemDTO>,
  AssertSerializable<AdminPostDTO>,
  AssertSerializable<PostStatsDTO>,
];
