# AGENTS.md — working rules for this codebase

The standing, enforced rules and the reason behind each. Topic documents in
`docs/` explain how to work within them; open the one that matches the task
before writing code.

| Document | Open it when |
|---|---|
| [`docs/architecture.md`](docs/architecture.md) | Deciding where code goes: folders, feature anatomy, barrels, request flows, route vs action, naming |
| [`docs/security.md`](docs/security.md) | Anything that reads a session, takes an id, or checks a permission |
| [`docs/data.md`](docs/data.md) | Queries, schema, migrations, DTOs, validation, errors, caching |
| [`docs/observability.md`](docs/observability.md) | Logging, events, error reporting, health check |
| [`docs/design.md`](docs/design.md) | Building or changing UI |
| [`docs/domain.md`](docs/domain.md) | A product term needs tracing to the feature and tables that own it |

## The commands

```
npx tsc --noEmit    # must be clean
npm run lint        # zero errors
npm run build       # also, when the change touches the client/server boundary,
                    # caching/prerendering, next.config.ts or instrumentation
```

<!-- Testing decision: state it. E.g. "No test runner, by decision — tsc, lint,
     build and manual checks are the gates." or name the runner and command. -->

## Language

- User-facing text is <LANGUAGE> (UI copy, errors shown to users, email/SMS, validation messages).
- Code comments and `docs/` are English. Do not translate string literals while editing comments.

## Layout

```
src/server/     infrastructure every feature inherits (env, db, errors, logger,
                auth, rate limits, cache tags, defineRoute/defineAction, health)
src/features/   one directory per domain — the only place with queries
src/app/        URLs: pages, layouts, route handlers. Shells, no business logic
```

The feature list is frozen in `src/server/features.ts`; a new domain is agreed first.

## Authorization

- Identity comes from the session, never from input (query, body, params, a
  client-written cookie, or a model's tool arguments).
- **The check lives in the dal.** `defineRoute({ auth })` / `defineAdminAction({ page })`
  are fast filters; the `require*` call inside the dal function is the guarantee.
- <!-- If there is an admin panel: --> `Admin` is not a `User`: separate table,
  cookie and page-path RBAC. `/admin/*` URLs are frozen — permission rows are
  keyed on them. Client-side permission hooks only decide what the UI draws.

## What the linter catches

| Rule | Catches |
|---|---|
| `@/server/db` only in `src/server/**` and `features/*/dal.ts` | queries outside the data layer |
| `zod` only in `src/lib/validation.ts` | validation messages silently changing language |
| deep `@/features/*/*` imports banned (except `/client`; `/system` from cron only) | reaching past a feature's barrel |
| `@/server/auth` banned under `src/app/api/**` | routes hand-rolling the try/catch `defineRoute` removes |
| `@prisma/client` value imports outside the data layer | the schema map shipping to the browser |
| inline `cacheLife({...})`, string tags in `cacheTag`/`revalidateTag`/`updateTag` | durations and tags outside their one file |
| `fetch('/api/…')` in feature code | server code calling its own API |
| `console.*` | logs with no request id, level or redaction |

## Not caught by tsc or lint — check by hand in review

1. **Every dal function that writes resolves its own identity** (`requireUserId()`,
   `requireAdminPermission(page, 'full')`). Read the function body, not the caller.
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

## Definition of done

- [ ] tsc clean, lint error-free, build green when the change is in a build-only area
- [ ] Code where `docs/architecture.md` puts it; no deep imports; no other feature's tables
- [ ] Identity and parent scope resolved inside the dal
- [ ] Mutations invalidate their tags
- [ ] UI from the component library; loading, empty and error states
- [ ] No `console.*`
- [ ] The real path walked in a browser; horizontal access checked (user B cannot read or modify user A's data) when data access changed
- [ ] If a rule changed, the document stating it changed in the same commit

## Things that fight this architecture

<!-- Project-specific exceptions and why they exist: routes that stay routes
     forever (payment callbacks, LLM streaming, large uploads), legacy areas
     out of scope, contexts that must not be split… -->
