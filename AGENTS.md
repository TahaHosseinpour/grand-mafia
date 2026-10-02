# AGENTS.md — working rules for this codebase

Grand Mafia is a Persian (RTL) rewrite of the Secret Hitler.io lobby game on
Next.js 16 + TypeScript + Prisma/PostgreSQL + Tailwind, with the game running
over Socket.IO in the same process. The pre-rewrite Express/Mongo app lives in
`legacy/` as the porting reference until every feature has moved.

The standing, enforced rules and the reason behind each. Topic documents in
`docs/` explain how to work within them; open the one that matches the task
before writing code. **This file overrides `docs/` where they differ.**

| Document | Open it when |
|---|---|
| [`docs/migration.md`](docs/migration.md) | Porting anything from `legacy/`: phases, status, what is ported where |
| [`docs/architecture.md`](docs/architecture.md) | Deciding where code goes: folders, feature anatomy, barrels, request flows, route vs action, naming |
| [`docs/security.md`](docs/security.md) | Anything that reads a session, takes an id, or checks a permission |
| [`docs/data.md`](docs/data.md) | Queries, schema, migrations, DTOs, validation, errors, caching |
| [`docs/observability.md`](docs/observability.md) | Logging, events, error reporting, health check |
| [`docs/design.md`](docs/design.md) | Building or changing UI |
| [`docs/domain.md`](docs/domain.md) | A product term needs tracing to the feature and tables that own it |

## The commands

```
pnpm dev            # custom server (Next + Socket.IO) on :3000, needs Postgres
pnpm typecheck      # must be clean
pnpm lint           # zero errors
pnpm test           # vitest — the game engine's rules are covered here
pnpm build          # also, when the change touches the client/server boundary,
                    # caching/prerendering, next.config.ts or instrumentation
pnpm db:migrate     # create/apply a migration (never `prisma db push`)
```

Testing decision: **vitest for the game engine** (pure rules: deck, elections,
powers, win conditions) and for anything with branching logic that can run
without a browser. Pages and components are checked with tsc, lint, build and
by walking the real path in a browser.

## Language

- User-facing text is **Persian** (UI copy, errors shown to users, emails,
  validation messages, game log lines). Numbers shown to users use Persian
  digits (`toLocaleString('fa-IR')`).
- Code comments and `docs/` are English. Do not translate string literals while editing comments.
- Game terms are a direct translation of the original (لیبرال، فاشیست، هیتلر،
  رئیس‌جمهور، صدراعظم…); the glossary is `src/lib/glossary.ts` — use it, do not
  invent synonyms. Card and board **images keep their English text** for now
  (decision: to be replaced by Persian artwork later, same file names).

## Layout

```
server.ts       process entry: Next + Socket.IO on one HTTP server
src/server/     infrastructure every feature inherits (env, db, errors, logger,
                auth, socket-auth, rate limits, cache tags, defineRoute/defineAction, health)
src/realtime/   Socket.IO wiring: handshake auth, event → handler registration.
                The socket equivalent of `src/app/api` — no queries, no game rules
src/features/   one directory per domain — the only place with queries
src/app/        URLs: pages, layouts, route handlers. Shells, no business logic
legacy/         the old app, read-only reference; deleted when the port is done
```

The feature list is frozen in `src/server/features.ts`; a new domain is agreed first.

## Project decisions that differ from the generic architecture

1. **Staff are users.** Moderators, editors and admins are `User` rows with a
   `staffRole`, and they moderate from inside the game client — as in the
   legacy app. There is no `Admin` table, admin cookie or `/admin/*` panel.
   Staff power (`src/server/staff.ts`) is re-read from the database on every
   staff operation (`requireStaff(minPower)` / the socket `Actor`), never
   trusted from a token or the client.
2. **The realtime layer is an entry layer.** A Socket.IO event is to
   `src/realtime/` what a request is to `src/app/api/`. Identity comes from
   `socket.data.actor`, resolved once at handshake from the session cookie
   (`src/server/socket-auth.ts`). **Dal functions called from socket handlers
   take the `Actor` as their first argument** and must never accept a
   username/userId from the event payload as "who is acting".
3. **Live game state is in memory**, in one process, as before. One instance
   only; a restart drops games in progress. Finished games are persisted.
4. **No Sentry.** Errors go to pino; `src/instrumentation.ts` logs escaped
   render errors.
5. **`server-only` in the custom server.** `scripts/register-hooks.mjs`
   resolves `server-only` to an empty module for the plain-Node process
   (server.ts, seed, scripts); Next's bundles still enforce it.
6. **Prisma 7**: client generated into `src/generated/prisma` (git-ignored),
   `pg` driver adapter, settings in `prisma.config.ts`.

## Authorization

- Identity comes from the session (HTTP) or the socket's `Actor` (realtime),
  never from input (query, body, params, an event payload, a client-written cookie).
- **The check lives in the dal.** `defineRoute({ auth })` / `defineAction({ auth })`
  are fast filters; the `require*` call (or the `Actor` check) inside the dal
  function is the guarantee.
- Client-side staff checks only decide what the UI draws.

## What the linter catches

| Rule | Catches |
|---|---|
| `@/server/db` only in `src/server/**` and `features/*/dal.ts` | queries outside the data layer (realtime included) |
| `zod` only in `src/lib/validation.ts` | validation messages silently changing language |
| deep `@/features/*/*` imports banned (except `/client`; `/system` from cron only) | reaching past a feature's barrel |
| `@/server/auth` banned under `src/app/api/**` | routes hand-rolling the try/catch `defineRoute` removes |
| value imports from `@/generated/prisma/*` outside the data layer | the schema map shipping to the browser |
| inline `cacheLife({...})`, string tags in `cacheTag`/`revalidateTag`/`updateTag` | durations and tags outside their one file |
| `fetch('/api/…')` in feature code | server code calling its own API |
| `console.*` | logs with no request id, level or redaction |

## Not caught by tsc or lint — check by hand in review

1. **Every dal function that writes resolves its own identity** (`requireUserId()`,
   `requireStaff(n)`, or validates the `Actor` it was given). Read the function body, not the caller.
2. **A child write is scoped to its parent**: `updateMany({ where: { id, parentId } })`
   + `count === 0` → `NotFoundError`, or `findFirst({ id, parentId })` first.
3. **A `'use client'` file imports `@/features/<name>/client`**, never values from
   `@/features/<name>`. DTO types via `import type` on their own line. Only `next build` catches this.
4. **A `try/catch` around a `'use cache'` call is not a fallback** — a throw inside a
   cached function is a prerender error. Cached reads return null; the page decides.
5. Every `'use cache'` has a `cacheTag` from `@/server/cache-tags` and a `cacheLife`
   profile that exists in `next.config.ts` (a misspelt name silently uses `default`).
6. Every mutation invalidates its tags (in the dal), or the commit says why not.
7. No DTO has a `Date`; every form field maps to a real column.
8. **Socket payloads are validated** with the feature's Zod schema before use,
   and the information a socket receives respects hidden roles: a player's
   role, party or the deck order never reaches a client that may not see it.
9. **A ported behaviour matches legacy** — same rules, same timings, same
   flow. A deliberate change is written in the commit message.

## Definition of done

- [ ] tsc clean, lint error-free, tests green, build green when the change is in a build-only area
- [ ] Code where `docs/architecture.md` puts it; no deep imports; no other feature's tables
- [ ] Identity and parent scope resolved inside the dal
- [ ] Mutations invalidate their tags
- [ ] UI from `src/components/ui`; Persian copy; RTL and phone width checked; loading, empty and error states
- [ ] Looks and behaves like the legacy screen it replaces (only Persian + responsive differ)
- [ ] No `console.*`
- [ ] The real path walked in a browser; horizontal access checked when data access changed
- [ ] `docs/migration.md` status updated; if a rule changed, the document stating it changed in the same commit
