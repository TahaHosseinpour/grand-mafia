import type * as P from '@prisma/client';

/**
 * Browser-safe copies of the Prisma enums that client-reachable code needs.
 *
 * Importing any *value* from `@prisma/client` in code that reaches a client
 * bundle (an `inputs.ts` a form validates with, a `'use client'` component)
 * pulls in Prisma's browser index — CommonJS, not tree-shaken, carrying the
 * field map of every model (`passwordHash`, `otp`, …) into a public chunk.
 * ESLint bans value imports from `@prisma/client` outside `src/server` and
 * dal files; import enums from here instead.
 *
 * Each object is checked against the generated type with `satisfies
 * Mirror<…>`: a member added to or removed from the schema fails `tsc` here
 * instead of drifting. Each name is both a value and a type, like the Prisma
 * export it replaces, so `z.enum(PostStatus)` and `status: PostStatus` work.
 */

type Mirror<T extends string> = { readonly [K in T]: K };

export const PostStatus = {
  draft: 'draft',
  published: 'published',
  archived: 'archived',
} as const satisfies Mirror<P.PostStatus>;
export type PostStatus = P.PostStatus;
