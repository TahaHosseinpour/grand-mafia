# Data, validation, errors, caching

How data is read, validated, shaped, cached and invalidated. Read before
writing a dal function, changing the schema, or adding `'use cache'`.

## Database (Prisma + PostgreSQL)

- **One** `prisma/schema.prisma`. It stays one file.
- Only dal files (and `src/server`) import the client, from `@/server/db`.
- Columns `snake_case` via `@map`/`@@map`; Prisma fields `camelCase`; ids
  autoincrement `Int`; `userId` is a `number`.
- Each feature owns its tables (documented in `docs/domain.md`). Never read
  another feature's tables — call its barrel.
- Mirror column limits in Zod: `VarChar(100)` → `.max(100)` (long input is a
  400, not a 500).

### Schema changes

- **Never `prisma db push`.** Every change is a migration file in
  `prisma/migrations/` — `npx prisma migrate dev --name <change>`.
- If `migrate dev` breaks (shadow-database replay fails because history has a
  table created by an old `db push`), the manual sequence is:
  1. `npx prisma migrate diff --from-url "$DATABASE_URL" --to-schema-datamodel prisma/schema.prisma --script`
  2. save as `prisma/migrations/<timestamp>_<name>/migration.sql`
  3. `npx prisma db execute --file <that file> --schema prisma/schema.prisma`
  4. `npx prisma migrate resolve --applied <timestamp>_<name>`
  5. `npx prisma generate`
- Production migrations run only inside the deploy (`prisma migrate deploy`
  after a verified backup); a destructive migration (drop/rewrite) needs an
  explicit allow-list entry. Never run it by hand against production.
- Seed scripts: `prisma/seed-<name>.ts`, run with `npx tsx`. Read before
  running — keep destructive cleanup scripts clearly named.

## DTOs

- Every dal read: explicit `select` declared `satisfies Prisma.<Model>Select`
  + a mapper to a DTO. Never return a raw row or spread one.
- DTOs are `type` aliases (never `interface`) listed in an
  `AssertSerializable<…>` tuple at the bottom of `types.ts`.
- **`Date` → ISO `string`; `Decimal` → `number`; `Json` → a checked shape.**
  Nothing from `Prisma.` in a DTO.
- Admin and public shapes are separate types and functions. An admin DTO does
  not extend a public DTO whose mapper filters rows — the admin editor then
  silently loses the filtered rows (pending items, inactive plans).
- Lists return `Paged<T>` via `paged(items, total, page, pageSize)`.
- Client components type props with the DTO, never a hand-written copy.

## Validation

- Schemas live in the feature's `inputs.ts`:
  `import { z, zId, zText, … } from '@/lib/validation'`. Importing `zod`
  directly is a lint error (messages would silently change language).
- Reuse the helpers: `zId`, `zOptionalId`, `zNullableId`, `zIdParams`,
  `zSlug`, `zText(label, {max})`, `zOptionalText`, `zNullableText`,
  `zMobile`, `zEmail`, `zPassword`, `zOtp`, `zLink`, `zCount`, `zAmount`,
  `zBoolean`, `zDate`, `zPagination(default, max)`, `zSearch`, `zIdList`.
- Optional vs nullable: `zOptional` = "not sent / leave it"; `zNullish` =
  `''`/`null` means "clear the column". Both carry an outer `.optional()`
  so `z.input` (what an action's caller passes) treats the key as optional.
- Schemas are **hand-written**, never generated from the Prisma model (mass
  assignment: a client sends `role: 'admin'`).
- Update schemas are `.partial()`; actions wrap as `{ id, data }`.
- `zPagination` clamps an over-max `limit` and falls back on junk. A picker
  needing every option calls an unpaginated list function.
- Route params: `defineRoute({ params: zIdParams() })`. Calling `.parse()` in
  a handler turns a 400 into a 500 (a raw `ZodError` is a bug to `toAppError`).
  In a page, `safeParse` and fall back.
- **Every form field maps to a real column.** Two faults look identical in
  the UI and have opposite fixes: column exists but the schema lacks the key
  → Zod strips it and it never saves (**wire it up**); no column at all → the
  UI is built on nothing (**delete the field**).

## Errors

The dal throws `AppError` subclasses and never builds a `Response`; the
factories translate. Clients branch on `code` (`UNAUTHORIZED`, `FORBIDDEN`,
`NOT_FOUND`, `VALIDATION`, `CONFLICT`, `RATE_LIMITED`, `INTERNAL`,
`UNAVAILABLE`, + project codes), never on the message. Any infrastructure
`catch` calls `rethrowFrameworkErrors(error)` first.

- Unique violation (`P2002`) → `ConflictError` with a reason.
- A delete blocked by a required relation → `ConflictError` explaining what
  blocks it, not a foreign-key 500.
- Not found / not yours → `NotFoundError` (do not reveal that someone else's
  row exists).

## Writes

- Writes that must succeed together share one `prisma.$transaction`. A
  cross-feature cleanup passes the transaction along:
  `purgeUserXForAdmin(tx, userId)`.
- Side effects that must never be skipped (notifications, ledger entries)
  are called from inside the dal write, not left to the caller.
- Work after the response uses `after()` from `next/server`, never a floating
  promise.
- Concurrency-sensitive state changes (consume a code, take the last seat)
  use a conditional `updateMany` and check `count`.

## Domain invariants to fix on day one

Decide once and document: the **timezone** for day/week/month boundaries
(e.g. Tehran, Jalali months — never bucket by UTC or server-local date);
the **money unit** (e.g. tomans everywhere, no ×10 conversions); derived
balances (never store a balance you can sum from a ledger); business numbers
defined once as named constants.

## Caching — Cache Components (Next 16)

`cacheComponents: true`. Anything not explicitly cached is **dynamic**, and
dynamic data must sit under a `<Suspense>` boundary (`loading.tsx` counts).

### What may be cached

| May be cached | Never cached |
|---|---|
| Public catalogue/listings, public item pages, blog, marketing copy, public verification pages, content shared by all participants | per-user progress, wallets, payments, notifications, grading/judging, leaderboards that must be live, anything under `/admin` |

Pages that mix the two cache the shared half and read the rest per request
(see `templates/src/app/posts/[slug]/page.tsx`):

```
static markup ............ always in the static shell
'use cache' read ......... in the shell if its lifetime allows
<Suspense> ............... fallback in the shell, content per request
```

When the cached half is gated (participants only), it is a **private**
function with no access check, called only after the gate passed.

### How to cache

```ts
export async function listPublishedPosts(query: ListPostsQuery) {
  'use cache';
  cacheLife('catalog');    // a profile name, never an object (lint)
  cacheTag(tags.posts);    // from @/server/cache-tags only (lint)
  // … arguments are part of the cache key
}
```

`'use cache'` may sit on a dal function (preferred — every caller benefits)
or a page/component.

| Profile | stale / revalidate / expire (s) | For |
|---|---|---|
| `marketing` | 3600 / 3600 / 86400 | marketing copy |
| `catalog` | 300 / 300 / 3600 | public listings |
| `detail` | 3600 / 900 / 86400 | one public item page |
| `userData` | 60 / 60 / 300 | per-user data under a userId-keyed tag |
| `volatile` | 30 / 15 / 300 | counters |

- Durations exist only in `next.config.ts`. `cacheLife` accepts any string —
  **a misspelt profile silently falls back to `default`**; check by hand.
- `revalidate: 0`, `expire` < 5 min, or `stale` < 30 s drop that subtree out
  of the prerender (a request-time hole).
- **Never call `cookies()`/`headers()` inside `'use cache'`.** Read the
  session outside and pass `userId` in as an argument so it is part of the
  key. Caching user A's data under a key without their id serves it to user B.
- **A cached read needs a tag that every mutation of that data
  invalidates.** No tag, no cache.
- **A throw inside `'use cache'` is a prerender error** that a caller's
  `try/catch` never sees. Cached reads return `null`/empty and the page
  decides (`notFound()`). If a page must degrade gracefully on a DB error,
  the read it wraps must not be cached. Caching an *empty* result pins it for
  the profile's lifetime unless a tag clears it.
- Variants: `'use cache: private'` (per-user, browser-side, may read
  cookies; for prefetch), `'use cache: remote'` (shared handler across
  instances — only with `cacheHandlers` configured and a high hit rate).
- Multi-instance self-hosting: the default cache is per instance. Prefer
  fewer/larger instances, a CDN in front, or `generateStaticParams` before a
  remote cache handler — and feature code never changes either way.
- Caches are per build; a deploy starts cold.
- Maximise the static shell: do not `await params` at the top of a layout;
  pass the promise down and unwrap it inside a `<Suspense>`.
- Never call `Date.now()`/`new Date()` during render of cached/prerendered
  output — use a client `useNow()` hook (server value = "unknown").

### Invalidation — in the dal, beside the write

| API | Behaviour | Use when |
|---|---|---|
| `revalidateTag(tag, 'max')` | background refresh; others see stale until ready | **the default** after a change |
| `updateTag(tag)` | expires and re-reads within the same request | only in code reached solely from a Server Action, when the author must see the change at once (throws elsewhere) |
| `refresh()` | refreshes uncached data only | in a Server Action, when a live counter elsewhere on the page must move |
| `revalidateTag(tag, { expire: 0 })` | stale copy never served again | data that must be gone now |

The one-argument `revalidateTag` is deprecated. Invalidate in the dal, not
the action — otherwise the second mutation path forgets. After a rename,
revalidate both the old and the new item tag.

**`tsc` and lint cannot see prerender or cache errors. Run `npm run build`
for any caching change.**
