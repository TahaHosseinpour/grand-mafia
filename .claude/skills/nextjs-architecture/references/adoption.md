# Adoption — bootstrapping a new project, migrating an existing one

## A. New project

Assumed stack: Next.js 16+ App Router (`cacheComponents`), React 19,
TypeScript `strict`, PostgreSQL + Prisma, Zod 4, ESLint 9 flat config,
pino, Sentry, Node 22, and a UI library + styling stack **of the project's
choice** (ask; shadcn/ui is one option, not a requirement — the example
components in `templates/` import `@/components/ui/*` and must be pointed at
whatever the project uses). Adapt the templates if a piece
differs (see "Adapting" in SKILL.md).

### Phase 0 — base (half a day)

- [ ] `npx create-next-app@latest` (TypeScript, App Router, `src/`, alias `@/*`); `strict: true` in `tsconfig.json`.
- [ ] Packages: `npm i @prisma/client zod pino server-only jsonwebtoken @sentry/nextjs` and `npm i -D prisma pino-pretty @types/jsonwebtoken tsx`.
- [ ] `package.json` scripts: `"build": "prisma generate && next build"`, `"postinstall": "prisma generate"`, `"lint": "eslint ."`, `"dev:pretty": "next dev | npx pino-pretty"`; `"engines": { "node": ">=22" }`.
- [ ] Copy from `templates/`: `src/lib/validation.ts`, `src/server/env.ts`, `db.ts`, `errors.ts`, `types.ts`, `log-context.ts`, `logger.ts`, `events.ts`.
- [ ] `.env.example` with every key in the env schema (no real values). `.env*` in `.gitignore`.
- [ ] `prisma init`; merge `templates/prisma/auth-models.prisma` as needed; first migration with `prisma migrate dev`.

### Phase 1 — central configuration (an hour)

- [ ] `next.config.ts` from the template: `cacheComponents: true`, the `cacheLife` profiles, `output: 'standalone'`, security headers.
- [ ] `src/server/cache-tags.ts`, `rate-limits.ts`, `rate-limit.ts`, `routes.ts`, `features.ts` (the agreed feature list).
- [ ] `src/lib/admin-pages.ts` (if there is an admin panel), `src/lib/prisma-enums.ts`.

### Phase 2 — auth, factories, health (half a day)

- [ ] `src/server/session.ts`, `auth.ts`, `http.ts`, `action.ts`, `request.ts`, `health.ts`.
- [ ] `src/app/api/health/route.ts`; `src/instrumentation.ts`; Sentry wizard (`npx @sentry/wizard@latest -i nextjs`), then wrap `next.config.ts`.
- [ ] `features/auth` (sign-in/up/out using `startUserSession`/`endUserSession`, rate limits on every credential/OTP endpoint).

### Phase 3 — the reference feature (a day, carefully)

- [ ] Build **one real feature completely and cleanly**, modelled on `templates/src/features/posts/`: dal (identity in every write, parent scoping, select+mapper, cached public reads, invalidation, events), types with `AssertSerializable`, inputs, actions, both barrels, a page mixing static + `'use cache'` + `<Suspense>`.
- This feature is the pattern every later feature copies — especially when an agent writes them. Its mistakes get copied too. Take the time.

### Phase 4 — the safety net (half a day)

- [ ] `eslint.config.mjs` from the template. **Prove each guard fires** (violating file → error → delete).
- [ ] `.github/workflows/ci.yml`: `tsc --noEmit` + `npm run lint` on every PR.
- [ ] `AGENTS.md` and `CLAUDE.md` from the templates, filled in.
- [ ] `docs/`: copy and adapt `references/architecture.md` → `docs/architecture.md`, `security.md`, `data-and-caching.md` → `docs/data.md`, `observability.md`, `ui-design-system.md` → `docs/design.md`; start `docs/domain.md` (actors, each concept by owning feature with models, statuses, URLs).
- [ ] Set up the chosen UI library under `src/components/ui`; a component preview (`/design-system` route with `_registry/meta.ts` + demos, or Storybook).
- [ ] `npm run build` green.

### Phase 5 — every feature after

One feature per PR, in the reference shape. Agree the domain name in
`features.ts` first; record each cross-feature edge in `FEATURE_LAYERS`.

## B. Migrating an existing project

Big-bang rewrites are almost always abandoned halfway. Go feature by feature.

### Order

1. **Infrastructure first, purely additive** (phases 0–2 above). Nothing in
   existing code changes; `env`, `log()`, errors and factories just exist.
   Keep a thin re-export at the old Prisma path (`@/lib/prisma` →
   `@/server/db`) so hundreds of imports need no codemod; delete it last.
2. **Guards before the first feature moves.** Add the ESLint config with the
   legacy escape hatches:
   - `LEGACY_FILES` — files still allowed to query the database / import zod
     directly. Generate it from the current violations; **files come off,
     never on**. When it is empty, delete it.
   - Optionally a console-debt list with the same one-way rule.
   - Guarding `src/features/**` alone guards nothing (it starts empty): the
     risk is the old routes/pages of a migrated feature growing a second
     query beside the new dal. Remove a feature's paths from `LEGACY_FILES`
     in the same PR that adds its dal.
3. **The reference feature** (phase 3), migrated completely.
4. **Waves of features**, smallest blast radius first.

### Two PRs per feature

- **PR-1 — the dal.** Build `dal.ts`, `types.ts`, `inputs.ts`, `index.ts`;
  turn the existing routes into thin `defineRoute` shells over it. Behaviour
  identical, client untouched, always deployable. Keep schemas byte-identical
  to what the routes accepted.
- **PR-2 — actions.** Add `actions.ts` + `client.ts`, convert that
  feature's admin/interactive components to Server Actions, delete the routes
  that are then unused.
- No feature flags: both paths exist for exactly one PR and go through the
  same dal, so rollback is one revert.
- Do not change public or `/admin/*` URLs during the migration.

### Bugs you will find — fix the shape, record the count

While migrating, expect and look for: `userId` taken from query/body;
child writes by child id only; whole rows spread into responses
(`passwordHash`, `otp`); hand-written catch blocks returning 500 for 401s;
`Date` fields flipping type when a route becomes an action; form fields that
never saved (schema missing the key) or that have no column at all; raw
`process.env` reads with `|| ''`; `console.*` with secrets; deep imports and
self-fetches; admin checks only on the client.

### Things not to do while migrating

- Do not convert client pages to server components as a side quest.
- Do not rearrange route groups or rename URLs.
- Do not split a context/provider that exists to collapse parallel fetches.
- Do not touch out-of-scope marketing sections.
- Do not delete a half-dead domain concept by default — that is a product
  decision; ask.

## Decisions deliberately not taken (so they are not re-argued)

- **Monorepo/Turborepo** — build complexity with no benefit for one app; lint
  guards give the same boundaries for 1% of the cost. Revisit with a second app.
- **Separate `service.ts` + `repository.ts` layers** — two layers by default.
  Pure business maths (proration, overlap detection) goes in a `calc.ts`
  beside the dal when it actually appears.
- **tRPC** — Server Components + Server Actions already give a typed
  boundary; tRPC pays off only with external typed consumers.
- **Redis in the dal** — a second cache system with its own invalidation
  bugs. A shared cache sits *under* Next (`'use cache: remote'` +
  `cacheHandlers`), never beside it.
- **Redis for rate limiting from day one** — in-process until there are
  several instances; then swap `rate-limit.ts` only.
