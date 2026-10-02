# Architecture

> **Project note.** This document is the generic architecture reference. Where
> it differs from this project — moderators are users with a staff role (no
> separate `Admin` table), the Socket.IO realtime layer, no Sentry — the
> project rules in [`AGENTS.md`](../AGENTS.md) win.

Where code lives, how a request reaches the database, and which way
dependencies point. Copy this into a project as `docs/architecture.md` and
replace the examples with the project's own features.

## Principles

Every rule in this skill follows from one of these. To change a rule, first
name the principle it would violate; if none, change it.

1. **The security boundary is where data leaves the database** — the dal, not
   middleware/proxy, a page, an action or a route. In the App Router a Server
   Component, a Server Action, a route handler and a cron job can all reach
   the same data; the only point they share is the function that queries.
2. **Numbers and strings that matter are centralised and typed** — cache
   profiles, cache tags, rate limits, admin page paths, URLs, event names,
   env vars, feature names. One file each; a typo is a compile error.
3. **A rule is enforced, not recommended** — by the type system or ESLint.
   What neither can express becomes a written review item in `AGENTS.md`.
4. **Complexity is earned, not predicted.** A feature starts with the fewest
   files. A folder or layer is added when the single file actually hurts.
5. **Infrastructure stays out of domain code.** Which ORM, cache store or
   rate-limit backend is used is invisible from `features/`; swapping one
   changes `src/server/` or `next.config.ts`, not a feature.

## The shape

```
src/
  server/      infrastructure every feature inherits (server-only)
  features/    one directory per business domain — the only place with queries
  app/         URLs: pages, layouts, route handlers. Shells, no business logic
  components/  shared UI: ui/ library, cross-feature patterns, layout chrome
  lib/         small pure helpers, isomorphic — neither infra nor a domain
  hooks/       client hooks
  contexts/    client providers (UI state, never authorization)
prisma/        schema.prisma (one file), migrations, seed scripts
docs/          the rule documents
specs/         specs in progress; specs/done/ once shipped
```

## Layers and responsibilities

| Layer | Holds | Never holds |
|---|---|---|
| `app/` | `page.tsx`, `layout.tsx`, `loading.tsx`, `error.tsx`, `route.ts` | queries, business logic, access decisions |
| `server/` | connections, auth guards, errors, logging, central config, factories | anything one domain owns |
| `features/*/dal.ts` | access checks, queries, `select`s, DTO mappers, cache, invalidation, business events | HTTP, raw request parsing, rate limits |
| `features/*/actions.ts` | `defineAction`/`defineAdminAction` wrappers: schema + filters + one dal call | queries, logic |
| `features/*/inputs.ts` | Zod schemas and inferred input types | anything server-only |
| `features/*/types.ts` | DTO `type` aliases | runtime code |
| `lib/` | pure, isomorphic helpers (`cn`, date formatting, validation) | `db`, `env`, anything server-only, anything one feature owns |
| `components/ui/` | generic, domain-free UI | data access, feature logic |

### Why `actions.ts` and `dal.ts` are separate

Two directives are mutually exclusive:

- `'use server'` — every exported function becomes a **public HTTP endpoint**.
- `import 'server-only'` — the module must never be reachable from outside.

Merge them and every exported helper (even a harmless formatter) becomes
callable from any browser. Keep `actions.ts` thin and `dal.ts` private.

## `src/server/` — infrastructure

Something belongs here only if every feature inherits it. A dependency one
domain owns — a payment gateway, object storage, web push, an LLM agent, SMS
templates — sits beside that feature's dal: `payments/gateway.ts`,
`media/storage.ts`, `notifications/push.ts`. A transport several features
use (raw SMS sender, mailer) may live in `src/server/` while each feature
composes its own message. Full module list: `server-infrastructure.md`.

## `src/features/<name>/` — domains

The names are frozen in `src/server/features.ts`. A new domain is a change to
that list, agreed first — not a new folder.

| File | Holds | Rule |
|---|---|---|
| `dal.ts` | queries, selects, mappers, access checks, invalidation, events | `import 'server-only'` first line. The only feature file that imports `@/server/db`. Becomes `dal/*.ts` only after one file really hurts. |
| `types.ts` | DTOs | `type` aliases, checked with `AssertSerializable`. No runtime code. |
| `inputs.ts` | Zod schemas + inferred types | `z` from `@/lib/validation`; enums from `@/lib/prisma-enums`. Isomorphic — forms import it. |
| `actions.ts` | `'use server'` Server Actions | Only if the feature mutates from the UI. Each is one factory call over one dal function. |
| `components/` | the feature's UI | kebab-case files, default export. |
| `index.ts` | **server barrel**: dal, actions, inputs, types | Named exports, no `export *`. What is not exported is private. |
| `client.ts` | **client barrel**: components + forwarded actions | What `'use client'` files import. |
| `system.ts` | platform work for cron (`…ForUser`, queue flushes) | Re-exports from the dal; importable only from `src/app/api/cron/**`. |
| `constants.ts` | values server and browser both need | No `@/server/*` imports. |
| `config.ts` | server-only config read from `env` | `server-only`. |

Start with `dal.ts`, `types.ts`, `inputs.ts`, `index.ts`. Add the rest when
needed (principle 4).

### Two entry points — load-bearing

```ts
// Server components, routes, actions, other features
import { listPublishedPosts, type PostDTO } from '@/features/posts';

// 'use client' files
import { CommentForm, addCommentAction } from '@/features/posts/client';
import type { PostDTO } from '@/features/posts'; // types only, on their own line
```

A barrel is one module: a `'use client'` file importing a *value* from
`@/features/<name>` evaluates `dal.ts` → `server-only` + Prisma in the
browser bundle → build error. Neither tsc nor lint sees it; only
`next build`. Merging a type into a value import
(`import { action, type DTO } from '@/features/x'`) reintroduces the edge.
Server components may import either entry point.

### Dependencies between features

- A feature imports another **only through its barrel**, and only along an
  edge listed in `FEATURE_LAYERS` (`src/server/features.ts`), added in the
  same PR with a comment saying why. ESLint cannot check the graph; the list
  stays true only by review.
- A feature never reads another feature's tables — it calls that feature.
- `users` is a leaf. Nothing depends on `admin` or `auth`; the session is
  reached through `@/server/auth`.
- `admin` only composes: the dashboard asks each feature for its own numbers
  (`getXStatsForDashboard`, `…ForAdmin(userId)`); a user purge calls each
  feature's `purgeUser…ForAdmin(tx, userId)`.
- Polymorphic features (payments, certificates — "a payment for a course or
  an event") use ids + enums and never import the product features.
- Side effects that must never be skipped (a notification on approval) are
  called from inside the dal write, which makes the writer depend on
  `notifications` — record that edge.

## `src/app/` — URLs

Pages, layouts and routes resolve params, call a dal function or render a
feature component, and nothing more (a well-shaped page is 6–75 lines).

- **URLs do not move** casually: public URLs feed `sitemap.ts` and redirects;
  `/admin/*` paths are keys in permission rows.
- `proxy.ts` (formerly `middleware.ts`) is **not an auth boundary**
  (CVE-2025-29927). Use it for redirects/rewrites/headers only.
- Colocated non-route files start with `_` (`_components`) or sit beside the
  page as a client component.

### How a request reaches data

| Caller | Path |
|---|---|
| Server component page | `page.tsx` → dal function from the barrel |
| Form / button in a client component | Server Action (`defineAction`) → dal |
| Admin screen | client component → `defineAdminAction` → dal |
| Client page that must fetch (legacy, polling, mobile app) | `fetch('/api/…')` → `route.ts` via `defineRoute` → dal |
| Cron | `api/cron/**` with `defineRoute({ auth: 'cron' })` → `features/<x>/system` |
| Webhook / payment callback | `api/<x>/**` with `defineRoute({ auth: 'none' })` → dal (verify with the provider's API, never trust the payload) |

Server code **never fetches its own API** — it imports the dal (cookies are
not forwarded, types are lost, it costs a round trip).

### Route or Server Action?

- **Data shown on a page** → server component calls the dal. No route.
- **A mutation from the UI** → Server Action.
- **A route only when the consumer is outside React rendering:** webhooks and
  payment callbacks, cron, auth flows that run before a session exists,
  OAuth callbacks, a public/mobile API, non-JSON responses (file download,
  PDF, image, RSS, sitemap), long or streaming calls (LLM chat — an action
  has no cancellation), uploads larger than the **4.5 MB Server Action body
  cap**, `api/health`.

### Response shapes — different on purpose

| Entry point | Success | Failure |
|---|---|---|
| Route (`defineRoute`) | `{ success: true, data }` | `{ success: false, error, code, details? }` + HTTP status |
| Server Action | `{ ok: true, data }` | `{ ok: false, error, code, details? }` |

A component moved from `fetch` to an action cannot keep reading `.success`
without a type error. Clients branch on `code`, never on the message text.

```tsx
const result = await updatePostAction({ id, data });
if (!result.ok) {
  toast({ variant: 'destructive', title: result.error });
  return;
}
```

## `components/`, `lib/`, `hooks/`, `contexts/`

| Path | Put here | Not here |
|---|---|---|
| `components/ui/` | generic, domain-free UI, registered in the design-system preview | anything that knows what a post or user is |
| `components/<pattern>/` (`cards`, `admin`, `layout`) | patterns several features use | one feature's screen |
| `lib/` | pure isomorphic helpers: `utils` (`cn`), `datetime`, `validation`, `prisma-enums`, `admin-pages` | queries, auth, env, anything one feature owns |
| `hooks/` | client hooks (`use-toast`, `use-now`, `use-mobile`) | data access |
| `contexts/` | UI state providers | authorization (a client permission context only decides what to draw) |

**Keep `lib/` small.** It is not a junk drawer. Domain logic goes in its
feature; infrastructure in `src/server/`. If a `lib/` file imports `@/server`
or knows a domain noun, it is in the wrong place.

## Where does this go?

| You are adding… | Put it in |
|---|---|
| A query or a write | the owning feature's `dal.ts` |
| A DTO | the feature's `types.ts` (+ the `AssertSerializable` tuple) |
| Input validation | the feature's `inputs.ts` |
| A mutation the UI calls | the feature's `actions.ts` |
| One feature's screen | `src/features/<name>/components/`, exported from `client.ts` |
| A page | `src/app/…/page.tsx`, a shell over the feature |
| An endpoint for a non-React consumer | `src/app/api/…/route.ts` with `defineRoute` over the dal |
| Scheduled work | the dal + re-export from `system.ts` + `api/cron/<job>/route.ts` |
| A reusable UI control | `src/components/ui/` + the design-system registry |
| A cache duration | a `cacheLife` profile in `next.config.ts` |
| A cache tag | `src/server/cache-tags.ts` |
| A rate limit | `src/server/rate-limits.ts` |
| An audit/business event name | `src/server/events.ts` |
| An admin page | `ADMIN_PAGE_PATHS` in `src/lib/admin-pages.ts` |
| A public URL builder | `src/server/routes.ts` |
| An environment variable | the schema in `src/server/env.ts` (`NEXT_PUBLIC_*` stays raw `process.env`) |
| A Prisma enum the client needs | `src/lib/prisma-enums.ts` |
| A new domain | a proposal to change `src/server/features.ts` — ask first |

## Naming

| Thing | Convention | Example |
|---|---|---|
| dal reads | `get<X>` throws `NotFoundError` · `find<X>` returns null · `list<X>s` returns `Paged<T>` | `getPostForAdmin`, `findPublishedPostBySlug`, `listPublishedPosts` |
| dal writes | `create<X>`, `update<X>`, `delete<X>` | `createPostForAdmin` |
| Privileged variant | `…ForAdmin` | `listPostsForAdmin` |
| Admin dashboard / user profile reads | `…ForDashboard`, `…ForAdmin(userId)` | `getPostStatsForDashboard` |
| System work from cron | `…ForUser(userId, …)` or a verb, in `system.ts` | `publishScheduledPosts` |
| Predicates | question form | `hasActiveSubscription` |
| DTO | `<Thing>DTO`; admin shape `Admin<Thing>DTO` | `AdminPostDTO` |
| Input schema | `<verb><Thing>Input`, `list<Things>Query`; action wrapper `<verb><Thing>ActionInput` | `createPostInput` |
| Server Action | `<verb><Thing>Action`, `name: '<feature>.<verbThing>'` | `createPostAction`, `'posts.create'` |
| Feature component | kebab-case file, default export, re-exported by name from `client.ts` | `comment-form.tsx` → `CommentForm` |
| `ui` component | kebab-case file, named exports | `responsive-dialog.tsx` |
