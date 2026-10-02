---
name: nextjs-architecture
description: Feature-based full-stack Next.js architecture (App Router, Next 16+ with cacheComponents, Prisma, Zod) — src/server infrastructure (validated env, Prisma singleton, AppError hierarchy, pino logging with request context, audit events, JWT session + auth guards, defineRoute/defineAction factories, named rate limits, typed cache tags, health check) and src/features/<name> domains (dal.ts, actions.ts, inputs.ts, types.ts, server and client barrels, system.ts), enforced by ESLint guards. Use when starting a new Next.js project, migrating an existing one onto this structure, or adding anything to a project built this way — a feature, page, route, Server Action, query, cache, rate limit, env var, admin page — or deciding where code goes. Also triggers on: dal, data access layer, actions.ts, feature-based, error handling, central logging, health check, rate limit, cache components, eslint architecture rules, معماری, فیچربیس, ساختار پروژه, ریت لیمیت, لاگینگ.
---

# Next.js feature architecture

A full-stack Next.js shape where **infrastructure** lives in `src/server/`,
**each business domain** lives in `src/features/<name>/`, `src/app/` holds
only URL shells, and the rules are enforced by types and ESLint rather than
by memory. Working code for every piece is in `templates/`; the reasoning is
in `references/`.

## Step 0 — which situation are you in?

1. **The project already follows this architecture** (has `src/server/`,
   `src/features/`, an `AGENTS.md`/`docs/`): read the project's `AGENTS.md`
   and the relevant `docs/*.md` first. **Project docs override this skill**
   where they differ (they record decisions this skill cannot know). Then
   follow the recipes below.
2. **A new project**: follow `references/adoption.md` §A phase by phase,
   copying from `templates/`. Ask the user only for genuinely open decisions:
   the feature list, whether there is an admin panel, user-facing language,
   auth method (mobile+OTP / email / provider), **UI library and styling
   stack** (free choice — never install shadcn or any other by default),
   money unit and timezone.
3. **An existing Next.js project on another structure**: follow
   `references/adoption.md` §B — infrastructure first (additive), guards with
   a shrinking legacy list, one reference feature, then feature-by-feature
   PRs. Never a big-bang rewrite.
4. **Not a Next.js project** (Express, Nest, Vite SPA, socket servers…): do
   **not** copy the templates or start converting files. Ask the user whether
   the goal is a rewrite/migration onto Next.js or applying the principles to
   the current stack. If the latter, carry over what is stack-independent —
   feature folders with one data-access module each, identity from the
   session inside data access, parent-scoped writes, validated env, an error
   hierarchy translated only at the edge, request-scoped structured logging
   with redaction and named events, named rate limits, typed central config,
   a health endpoint, lint guards — and map each to that stack's equivalents.

When copying templates: read each file, adapt names and messages to the
project, keep the comments that explain *why*. Templates use Persian
user-facing strings and English comments; change the strings (and
`z.locales.fa()`) for another language.

## The five principles

1. **The security boundary is where data leaves the database** — the dal.
   Not middleware/proxy, not a page, not a route.
2. **Numbers and strings that matter are centralised and typed** — cache
   profiles, tags, rate limits, admin pages, URLs, events, env, feature names.
3. **Rules are enforced, not recommended** — types or ESLint; what neither
   can express is a written review item.
4. **Complexity is earned, not predicted** — fewest files first.
5. **Infrastructure stays out of domain code** — swap the ORM, cache store or
   limiter without touching a feature.

## The shape

```
src/
  server/            infrastructure (server-only unless noted)
    env.ts           validated env — `env.X`, lazy, no `|| ''`
    db.ts            Prisma singleton — imported only by dal files
    errors.ts        AppError + 401/403/404/400/409/429/500 classes, toAppError, rethrowFrameworkErrors
    types.ts         Paged<T>, Serializable, ActionResult<T>            (isomorphic)
    log-context.ts   AsyncLocalStorage: requestId, userId, adminId
    logger.ts        pino + redaction; `log()`
    events.ts        closed list of event names; logEvent / logSecurityEvent
    session.ts       cookie JWTs — started/ended only by features/auth
    auth.ts          getSession, requireAuth, requireUserId, requireAdmin, requireAdminPermission, requireSuperAdmin
    http.ts          defineRoute — every route.ts
    action.ts        defineAction / defineAdminAction — every Server Action
    request.ts       parseFormData, parseAnyBody (uploads, gateway callbacks)
    rate-limits.ts   named limits, numbers only                          (isomorphic)
    rate-limit.ts    enforceRateLimit — in-process, swappable
    cache-tags.ts    every cache tag                                      (isomorphic)
    routes.ts        public URL builders                                  (isomorphic)
    features.ts      frozen FEATURES list + FEATURE_LAYERS graph          (isomorphic)
    health.ts        checkHealth(): database + env
  features/<name>/
    dal.ts           'server-only'. auth checks, queries, select+mapper, cache, invalidation, events
    types.ts         DTO type aliases + AssertSerializable tuple
    inputs.ts        Zod schemas (z from @/lib/validation)
    actions.ts       'use server'. thin factory wrappers over the dal
    components/      the feature's UI
    index.ts         SERVER barrel: dal, actions, inputs, types
    client.ts        CLIENT barrel: components + forwarded actions
    system.ts        cron-only re-exports (identity-less platform work)
  app/               pages/layouts/routes = shells over feature barrels
  components/ui/     the project's component layer, any library (+ a preview)
  lib/               small pure isomorphic helpers: utils, validation, datetime, prisma-enums, admin-pages
  instrumentation.ts Sentry + onRequestError → Sentry and pino
next.config.ts       cacheComponents + every cacheLife profile
eslint.config.mjs    the architecture guards
AGENTS.md, docs/     the project's standing rules
```

## Non-negotiable rules

**Layout and boundaries**
- Only `src/server/**` and `features/*/dal.ts` import `@/server/db` (lint).
- Other code reaches a feature only via `@/features/<name>` (server) or
  `@/features/<name>/client` (`'use client'` files). No deep imports (lint).
  A `'use client'` file never imports a *value* from the server barrel — only
  `import type` on its own line (only `next build` catches this).
- A feature never reads another feature's tables; it calls its barrel along
  an edge recorded in `FEATURE_LAYERS` with a reason.
- `src/app/**` holds shells: parse params → call the dal → render. No logic.
- `lib/` stays small and pure; domain code goes in its feature, infra in `server/`.
- New domain = change to `features.ts`, agreed with the user first.

**Security**
- Identity comes from the session (`requireUserId()`), **never** from input —
  query, body, params, a client cookie, or LLM tool arguments.
- **Every dal write opens with its own `require*` check.** Factory options are
  only fast filters. Exceptions (public signup, `system.ts`) say so in a comment.
- **Child writes are scoped to the parent** (and owner): `updateMany/deleteMany({ where: { id, parentId[, userId] } })` → `count === 0` → `NotFoundError`.
- Admin ≠ user: separate table/cookie/guards; page-path RBAC with typed
  `AdminPagePath`; writes need `'full'`; admin management is `superAdmin`;
  `/admin/*` URLs are frozen.
- Explicit `select` + mapper; never return or spread a row. Admin and public
  DTOs are separate types and functions.
- No `@prisma/client` value imports outside the data layer (lint) — enums via `@/lib/prisma-enums`.
- Routes never import `@/server/auth` (lint) — use `defineRoute({ auth })`.
- `proxy.ts`/middleware is not an auth boundary.

**Data, validation, errors**
- DTOs: `type` aliases, `Date` → ISO string, `Decimal` → number, checked by `AssertSerializable`.
- `z` only from `@/lib/validation` (lint). Schemas hand-written (never derived
  from Prisma), mirror column limits, every field maps to a real column.
- Route params via `defineRoute({ params: zIdParams() })`, never `.parse()` in a handler.
- The dal throws `AppError` subclasses with user-language messages and never
  builds a `Response`. Clients branch on `code`. Every infra `catch` calls
  `rethrowFrameworkErrors` first.
- Routes answer `{ success, data | error, code, details? }`; actions answer
  `{ ok, data | error, code, details? }` and never throw.
- Multi-step writes share `prisma.$transaction`; must-not-skip side effects
  run inside the dal write; post-response work uses `after()`.
- Never `prisma db push` — always a migration.

**Caching (cacheComponents)**
- Uncached = dynamic = must be under `<Suspense>`/`loading.tsx`.
- `'use cache'` + `cacheLife('<profile>')` + `cacheTag(tags.x)`. Profiles only in
  `next.config.ts`, tags only in `cache-tags.ts` (lint). No tag → no cache.
- Never `cookies()`/`headers()` inside `'use cache'`; pass `userId` as an argument.
- A cached read returns null/empty instead of throwing; the page calls `notFound()`.
- Cache public shared data only; never per-user money/progress/admin data.
- Invalidate **in the dal beside the write**: `revalidateTag(tag, 'max')`
  by default; `updateTag` only in action-only paths.

**Rate limits, logging, health**
- Named limits in `rate-limits.ts` with a reason per number; applied via the
  factory `rateLimit` option or `enforceRateLimit` at the costly step. Required
  for SMS/email/LLM/payments/uploads/codes/passwords; credentials get per-IP
  **and** per-account buckets; shared costs get a `global` ceiling.
- `console.*` is banned (lint). Server: `log()`. Client: nothing, or
  `Sentry.captureException` for real failures.
- Errors are logged once, by the factory; the dal logs only business events
  via `logEvent(EVENTS.X)`. Expected 4xx at `warn`, bugs at `error`.
- `GET /api/health`: DB + env, 200/503, `no-store`, never rate-limited.

## Where does this go?

| Adding… | Put it in |
|---|---|
| a query or write | owning feature's `dal.ts` |
| a DTO / input schema | `types.ts` / `inputs.ts` |
| a mutation the UI calls | `actions.ts` (+ forward in `client.ts`) |
| a feature screen | `features/<name>/components/`, exported from `client.ts` |
| a page | `src/app/…/page.tsx` shell |
| an endpoint for a non-React consumer | `src/app/api/…/route.ts` with `defineRoute` |
| scheduled work | dal fn → `system.ts` → `src/app/api/cron/<job>/route.ts` (`auth: 'cron'`) |
| cache duration / tag | `next.config.ts` profile / `cache-tags.ts` |
| rate limit / event / URL / env var | `rate-limits.ts` / `events.ts` / `routes.ts` / `env.ts` |
| admin page | `ADMIN_PAGE_PATHS` in `src/lib/admin-pages.ts` |
| reusable UI control | `components/ui/` + design-system registry |

## Recipes

**Add a feature** — agree the name → add to `FEATURES` (+ `FEATURE_LAYERS`) →
schema models + migration → `types.ts`, `inputs.ts`, `dal.ts`, `index.ts` →
`actions.ts` + `client.ts` if the UI mutates → components → page shells →
tags in `cache-tags.ts` for anything cached → document it in `docs/domain.md`.
Copy the shape of `templates/src/features/posts/`.

**Add a mutation** — schema in `inputs.ts` → dal function opening with
`require*`, parent-scoped, select+mapper, invalidation, `logEvent` if
sensitive → `defineAction`/`defineAdminAction` (`name`, `page`/`access`,
`rateLimit` if costly) → export from both barrels → client calls it, branches
on `result.ok`, shows `result.error`, marks fields from `result.details`.

**Add a cached public page** — dal read with `'use cache'`, profile, tag
(returns null if missing) → every write to that data revalidates the tag →
page calls it; per-viewer parts in `<Suspense>` → `loading.tsx` if the page
awaits `params`/`searchParams` → `npm run build`.

**Add a route** — only for webhooks, callbacks, cron, auth-before-session,
public/mobile API, files/streams, big uploads, health. `defineRoute` with
`auth`, `params`/`query`/`input`, `rateLimit`; handler is one dal call.

## Checks

```
npx tsc --noEmit     # clean
npm run lint         # zero errors
npm run build        # REQUIRED when touching: 'use client' imports, client.ts,
                     # server-only modules, 'use cache'/cacheLife/cacheTag,
                     # <Suspense>/loading.tsx, cookies()/headers()/searchParams in
                     # a page or layout, next.config.ts, instrumentation, Sentry
```

tsc and lint cannot see client/server-boundary or prerender/cache errors; the
build is the only detector. Follow the project's own rules on *when* to run
checks (some users run them themselves at the end of a task).

## Definition of done

- [ ] tsc clean, lint error-free, build green for build-only areas
- [ ] Code where the architecture puts it; no deep imports; no foreign tables
- [ ] Every write resolves identity and parent scope **inside the dal**
- [ ] Every mutation invalidates its tags (or the commit says why)
- [ ] No DTO has a `Date`; no `/admin/*` URL changed
- [ ] UI from `components/ui`; user-language copy; loading/empty/error states
- [ ] No `console.*`
- [ ] Real path walked in a browser; two-account horizontal access check when data access changed
- [ ] If a rule changed, the doc stating it changed in the same commit

## Adapting

- **UI library**: the project's choice (shadcn/ui, Mantine, Chakra, MUI,
  hand-built; Tailwind or not). Only the discipline is fixed — a local
  `components/ui` layer, a component preview, tokens over values. The
  template components import `@/components/ui/*`; point them at the
  project's own components.
- **No admin panel**: drop the admin half of `auth.ts`, the admin modes in
  `http.ts`/`action.ts`, `admin-pages.ts` and the Admin models.
- **Different auth** (Auth.js, Clerk, DB sessions): rewrite `session.ts` and
  the guard bodies; keep the exported names and throw semantics.
- **Different ORM**: rewrite `db.ts` and the dal bodies; nothing else moves.
- **Several instances**: swap `rate-limit.ts` for a shared store; consider
  `'use cache: remote'` + `cacheHandlers`. Feature code is unchanged.
- **Test runner wanted**: add structural tests mirroring the lint guards and a
  two-user authorization test (see `references/eslint-guards.md`).

## Reference files

| File | Read when |
|---|---|
| `references/architecture.md` | deciding where code goes; layers, barrels, request flows, route vs action, naming |
| `references/server-infrastructure.md` | writing or changing anything in `src/server/` |
| `references/security.md` | sessions, ids, permissions, uploads, webhooks, LLM tools |
| `references/data-and-caching.md` | Prisma, migrations, DTOs, validation, errors, transactions, caching, invalidation |
| `references/observability.md` | logging, events, Sentry, health check |
| `references/eslint-guards.md` | editing `eslint.config.mjs`; the manual review list |
| `references/ui-design-system.md` | building UI with any library; the component preview; tokens; RTL |
| `references/adoption.md` | bootstrapping a new project or migrating an old one |

## Templates (copy, then adapt)

```
templates/
  src/server/*.ts                    all infrastructure modules
  src/lib/validation.ts              z + shared helpers (Persian locale)
  src/lib/admin-pages.ts, prisma-enums.ts
  src/instrumentation.ts
  src/app/api/health/route.ts
  src/app/api/cron/publish-scheduled/route.ts
  src/app/api/posts/route.ts         a thin route
  src/app/posts/page.tsx, loading.tsx, [slug]/page.tsx, [slug]/loading.tsx
  src/features/posts/                THE reference feature (dal, types, inputs, actions, index, client, system, components)
  prisma/auth-models.prisma          User, Admin, AdminPermission, + the example Post models
  eslint.config.mjs                  the guards
  next.config.ts                     cacheComponents + profiles + headers
  .github/workflows/ci.yml           tsc + lint
  AGENTS.md, CLAUDE.md               project rule-file skeletons
```
