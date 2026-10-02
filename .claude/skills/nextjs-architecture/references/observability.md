# Observability — logging, events, error reporting, health

Goal: one entry point for logs, structured JSON, traceable by request id,
with no secret leakage — plus alerting and a health endpoint the deploy and
monitors trust.

## Files

```
src/server/logger.ts       pino instance, redaction, log() bound to context
src/server/log-context.ts  AsyncLocalStorage: requestId, userId, adminId, route
src/server/events.ts       closed list of event names; logEvent, logSecurityEvent
src/server/health.ts       checkHealth(): database + environment
src/app/api/health/route.ts
src/instrumentation.ts     Sentry boot + onRequestError → Sentry and pino
sentry.{client,server,edge}.config.ts   (npx @sentry/wizard@latest -i nextjs)
```

Install: `npm i pino @sentry/nextjs` and `npm i -D pino-pretty`. Scripts:
`"dev": "next dev"`, `"dev:pretty": "next dev | npx pino-pretty"`.

## The governing rule: log at the boundary, once

> Every error is logged **once**, in the outermost layer that catches it.

| Layer | Logs |
|---|---|
| `dal.ts` | errors: **never** — it throws. Business events: yes (`logEvent`), because only the dal knows what happened |
| `defineRoute` / `defineAction` | every failure, automatically: ≥500 at `error` (with `err`/`cause`), expected rejections at `warn` |
| `rate-limit.ts` | `security.rate_limit` at `warn`; a crossed global ceiling at `error` + Sentry, once per window |
| `auth.ts` | `security.forbidden` at `warn` |
| `instrumentation.ts onRequestError` | anything that escaped everything (render throws) → Sentry + pino |
| client code | nothing; a genuine user-facing failure → `Sentry.captureException` |

`console.*` is a lint error across `src/`, no exemptions.

## Levels

| Level | When | Example |
|---|---|---|
| `fatal` | the process must die | DB unreachable at boot |
| `error` | a bug or unexpected failure | unknown Prisma error, gateway failure |
| `warn` | expected but worrying | rate limit hit, forbidden access, bad webhook signature |
| `info` | business event | signed up, published, payment verified |
| `debug` | development detail | intermediate values |

**An expected error is not `error`.** 401/404/409 are normal behaviour; at
`error` they bury real alarms.

## Request context

The factories create `requestId = crypto.randomUUID()` and run the handler in
`runWithContext({ requestId, route })`; after auth they `enrichContext({
userId })`. `log()` returns a pino child carrying all of it, so
`grep <requestId>` reconstructs a request. Always `log()`, never the root
logger (it loses the context). Where there is no request (boot, scripts) use
`rootLogger`.

## Redaction

pino `redact.paths` lists every shape a secret may take (`password`,
`passwordHash`, `token`, `otp`, `secret`, `apiKey`, `authorization`, `cookie`,
`*.x` variants, `headers.cookie`, `body.password`…). Even so: **never log a
whole object** (`log().info({ user })`); pick fields
(`{ userId: user.id }`). Event payloads are typed to primitives for this
reason. Never log the rate-limit key (an IP or a phone number).

## Events

`EVENTS` is an `as const` map of `<domain>.<action>` names. Free strings
drift (`payment_ok` / `payment.success` / `paymentVerified`) and no dashboard
can be built on them; a typo in a typed name is a compile error.

```ts
logEvent(EVENTS.CONTENT_PUBLISHED, { postId: row.id });       // info
logSecurityEvent(EVENTS.SECURITY_FORBIDDEN, { adminId, page }); // warn
```

Start with 5–10 events (auth, admin, payments, content, security) and add as
needed. Every sensitive admin operation logs one.

## Output format

Raw JSON lines in every environment, ISO timestamps, `level` as a label.
**No pino `transport`** — `pino-pretty` as a transport spawns a worker thread
that breaks under `output: 'standalone'`; pipe through it in `dev:pretty`
instead. Optionally set `base: { service: '<name>' }` when several services
share a log sink.

## Sentry and pino together

Not substitutes. Sentry alerts and groups repeated failures; pino holds the
full timeline of the request. `onRequestError` sends to both; the logger is
imported dynamically and only under the Node runtime (pino is `server-only`
and must not be pulled into the edge bundle). Client `error.tsx` shows the
`digest` so a user can report it and you can find it in the server log.

## Common mistakes

| Mistake | Why | Right |
|---|---|---|
| logging an error in the dal *and* the factory | every failure twice | throw in the dal; the factory logs |
| `error` for `NotFoundError` | noise drowns signal | `warn`/`debug` |
| `log().info({ user })` | leaks `passwordHash` | `{ userId }` |
| raw string instead of `EVENTS.*` | no dashboard possible | `events.ts` |
| root logger instead of `log()` | loses requestId/userId | `log()` |
| logging inside a loop | a thousand lines per operation | one line with a `count` |
| `console.log` in a client component | nobody reads it | remove; Sentry for real failures |

## Health check

`GET /api/health` → 200 `{ success: true, data: report }` or 503
`{ success: false, code: 'UNAVAILABLE', data: report }`, `Cache-Control:
no-store`, `await connection()`, **no rate limit**. Checks: database
(`SELECT 1`, 3 s timeout) and environment (`getEnv()`); report says only
`ok`/`fail`, reasons go to the log; `uptimeSeconds` tells a deploy that the
restart happened. The deploy script polls it after release and rolls back on
503; an uptime monitor polls it in production.
