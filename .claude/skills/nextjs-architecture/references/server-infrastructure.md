# `src/server/` — the infrastructure modules

Each module, its contract, and the decision behind it. Working code for every
one is in `templates/src/server/`. All are `import 'server-only'` except the
isomorphic config files marked *(isomorphic)*, which hold only names and
numbers and may be imported by client code.

| Module | Role |
|---|---|
| `env.ts` | Validated server env: `env.X`, `appUrl()`, `isProduction()` |
| `db.ts` | The Prisma client singleton. Imported only by dal files and `src/server` |
| `errors.ts` | `AppError` + subclasses, `toAppError`, `publicMessage`, `rethrowFrameworkErrors` |
| `types.ts` *(isomorphic)* | `Paged<T>`, `paged()`, `Serializable`, `ActionResult<T>` |
| `log-context.ts` | `AsyncLocalStorage` request context (`requestId`, `userId`, `adminId`, `route`) |
| `logger.ts` | pino with redaction; `log()` bound to the request context |
| `events.ts` | Closed list of event names; `logEvent`, `logSecurityEvent` |
| `session.ts` | Sign/verify/clear session cookies. Only `features/auth` starts or ends a session |
| `auth.ts` | The authorization boundary: `getSession`, `requireAuth`, `requireUserId`, `requireAdmin`, `requireAdminPermission`, `requireSuperAdmin` |
| `http.ts` | `defineRoute` — the route handler factory |
| `action.ts` | `defineAction`, `defineAdminAction` — Server Action factories |
| `request.ts` | `parseFormData`, `parseAnyBody` for uploads and third-party callbacks |
| `rate-limits.ts` *(isomorphic)* | The named limits — numbers only |
| `rate-limit.ts` | The enforcer: `enforceRateLimit(name, subject?)` |
| `cache-tags.ts` *(isomorphic)* | Every cache tag name/builder |
| `routes.ts` *(isomorphic)* | Builders for public URLs |
| `features.ts` *(isomorphic)* | The frozen feature list and `FEATURE_LAYERS` |
| `health.ts` | `checkHealth()` for `GET /api/health` |
| `sms.ts`, `mailer.ts` (optional) | Raw transports shared by features; each feature composes its own message |

## env.ts

- One Zod schema over `process.env`; `env` is a **Proxy** that validates on
  first *read*, not at import — `next build` imports every module and must
  not need production secrets.
- Only a successful parse is cached, so the health check sees a fixed `.env`.
- No `|| ''` fallbacks anywhere: a missing key is a loud error at first use,
  not an empty string that fails at the first real call.
- `NEXT_PUBLIC_*` stays raw `process.env.NEXT_PUBLIC_X` (inlined at build).
- No `env: {}` block in `next.config.ts` — it bakes values into the
  standalone image.
- `db.ts` deliberately does not import `env` (every dal imports `db`).

## db.ts

Singleton on `globalThis` in development (hot reload would otherwise open a
new pool per save). `server-only` so a client import is a build error.

## errors.ts

- The dal and logic layers **throw `AppError` subclasses and never build a
  `Response`**. `http.ts` and `action.ts` are the only translators.
- Classes: `UnauthorizedError` 401, `ForbiddenError` 403, `NotFoundError`
  404, `ValidationError` 400 (+ `details` per field), `ConflictError` 409,
  `RateLimitError` 429 (+ `retryAfter`), `InternalError` 500
  (`expose: false`).
- Each carries a default user-facing message in the project language; call
  sites pass a specific one (`new NotFoundError('مطلب یافت نشد')`).
- `toAppError(unknown)`: an `AppError` passes through; **anything else is a
  bug** → `InternalError`, original kept as `cause` for the log, user sees a
  generic sentence. Never put `error.message` or Prisma text in a response.
- `rethrowFrameworkErrors(error)` (`unstable_rethrow`) is the first line of
  every infrastructure `catch` — `redirect()` and `notFound()` work by
  throwing; swallowing them silently breaks navigation.
- 401 vs 403 are not interchangeable: a deactivated account is 403 (a 401
  causes a login redirect loop).
- `ErrorCode` is a closed union; add a domain code only when a client must
  react differently (e.g. `PAYMENT_PENDING` → "we are checking", not "pay
  again").

## log-context.ts + logger.ts + events.ts

See `observability.md`. In short: the factories create a `requestId` and run
the handler inside `runWithContext`; `enrichContext` adds `userId`/`adminId`
after auth; `log()` returns a pino child carrying it all; secrets are
redacted by path; event names are a closed `as const` list.

## session.ts + auth.ts

- Sessions are JWTs in `httpOnly`, `sameSite: lax`, `secure` (production)
  cookies. Separate cookies (and optionally secrets) for users and admins.
  No hardcoded fallback secret, ever.
- Token payloads are **shape-checked**, not cast — with one secret, a user
  token verifies as an admin token unless the id field is checked.
- `getSession` / `getAdminSession` are wrapped in React `cache()` and confirm
  the row still exists (a deleted account's token stays cryptographically
  valid).
- Guards **throw**; they never return an envelope a caller can forget to
  check.
- `requireAdminPermission(page, access)`: `page` is the typed
  `AdminPagePath`; super admin passes everything; `'read'` accepts read|full;
  `'full'` only full. A database error propagates (never turned into
  "no access").
- `requireSuperAdmin` guards the privilege-escalation surface;
  `assertAdminIsManageable` forbids editing super admin accounts via the panel.
- Using another auth system (Auth.js, Clerk, Lucia, database sessions)?
  Replace `session.ts` and the bodies of the guards; keep the exported names
  and throwing semantics so features do not change (principle 5).

## http.ts — `defineRoute`

```ts
export const POST = defineRoute({
  auth: 'user',                    // 'none' | 'user' | 'admin' | { admin: { page, access } } | 'superAdmin' | 'cron'
  rateLimit: 'UPLOAD',             // a RateLimitName
  rateLimitSubject: (body) => body.mobile,   // only for by: 'subject' limits
  params: zIdParams(),             // [id] arrives as a number; junk → 400
  query: listThingsQuery,
  input: createThingInput,         // JSON body
  handler: ({ params, query, body, session, admin, request }) => createThing(body),
});
```

Order inside: request id + log context → parse params/body/query (→ 400) →
auth (→ 401/403) → rate limit (→ 429, after auth so `by: 'user'` has an id)
→ handler → `{ success: true, data }`. A handler returning a `Response`
(download, redirect, XML) passes through. The `catch`: `toAppError`, log once
(≥500 `error`, else `warn`), envelope with `publicMessage`, `Retry-After`
headers on 429. `'none'` still resolves an optional session for
personalisation. `'cron'` compares `Bearer $CRON_SECRET` in constant time.

## action.ts — `defineAction` / `defineAdminAction`

```ts
export const createPostAction = defineAdminAction({
  name: 'posts.create',          // '<feature>.<verbThing>' — logs only
  page: '/admin/posts',          // typed AdminPagePath
  access: 'full',                // default 'full'; list/read actions say 'read'
  input: createPostInput,
  handler: (input, admin) => createPostForAdmin(input),
});

export const addCommentAction = defineAction({
  name: 'posts.addComment',
  auth: 'user',                  // default; 'none' → handler gets session null
  rateLimit: 'COMMENT',
  input: addCommentInput,
  handler: (input, session) => addComment(input),
});
```

- Two factories because an admin is not a user — one factory with an
  optional `page` makes the admin check forgettable.
- Generic over the **schema**: callers pass `z.input` (what a form holds),
  handlers get `z.output` (what the dal needs).
- **Never throws to the caller** (a thrown error reaches the client as an
  opaque digest): catches, logs once, returns `{ ok: false, error, code, details? }`.
- `superAdmin: true` for admin/role/permission management.

## request.ts

`parseFormData(request, schema)` for multipart uploads; `parseAnyBody` for
third-party callbacks that lie about content-type. Both throw
`ValidationError`, so inside `defineRoute` they become the standard 400.

## rate-limits.ts + rate-limit.ts

- Numbers in one file (`{ windowMs, maxRequests, by }` + a comment saying why
  each number is what it is); enforcement in the other.
- `by`: `'ip'` | `'user'` | `'subject'` (caller-supplied key such as the
  mobile number; overloads make it **required** at the call site) |
  `'global'` (one bucket for the platform — a cost ceiling; crossing it logs
  an error and alerts once per window).
- In-process `Map` with a sweeper: resets on deploy, **per instance**. This
  module is the only thing to swap (Redis/Upstash) when scaling out.
- Client IP from `x-real-ip` (proxy must overwrite it), then the first
  `x-forwarded-for`. Header order is load-bearing.
- Applied at the entry layer (`defineRoute`/`defineAction` option), or via
  `enforceRateLimit` at the exact step that costs money (e.g. right before
  sending an SMS). Never as a blanket dal rule — a Server Component calling
  the same read would be throttled.
- Every credential check gets two buckets: per IP **and** per account
  (subject), so rotating IPs buys no extra guesses.
- Never loosen or "re-derive" a tuned number during a refactor.

## cache-tags.ts

`tags.things` (list), `tags.thing(slug)` (one), `tags.userThings(userId)`
(per user). Every `cacheTag`/`revalidateTag`/`updateTag` argument comes from
here (lint). A new cached data kind gets its builder here first. Key by
whatever both the read and write side can always produce.

## routes.ts

`routes.post(slug)` instead of template strings at call sites;
`absoluteUrl(path, appUrl())` for emails, SMS, callbacks, sitemap, OG tags.
Admin paths live in `src/lib/admin-pages.ts`, not here.

## features.ts

`FEATURES` (frozen list → `FeatureName`) and `FEATURE_LAYERS` (the
dependency graph, each edge with a reason). Not lint-enforced — kept true in
review.

## health.ts + `api/health/route.ts`

`checkHealth()`: database `SELECT 1` with a 3 s timeout + `getEnv()`.
Report says only `ok`/`fail` per check (the endpoint is public); reasons go
to the log. Route: `defineRoute` with `auth: 'none'`, `await connection()`
(never prerendered), `Cache-Control: no-store`, 200 or 503 with code
`UNAVAILABLE`, **never rate-limited** (a 429 reads as "down" and rolls back
a healthy deploy). Add checks only for dependencies without which nothing
works.

## instrumentation.ts

`register()` loads Sentry per runtime. `onRequestError` reports to Sentry
**and** pino (dynamic import, Node runtime only — pino is `server-only` and
must stay out of the edge bundle). It is the last net for errors that escaped
every try/catch (render-phase throws).
