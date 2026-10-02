# Security and access

> **Project note.** This document is the generic architecture reference. Where
> it differs from this project — moderators are users with a staff role (no
> separate `Admin` table), the Socket.IO realtime layer, no Sentry — the
> project rules in [`AGENTS.md`](../AGENTS.md) win.

Who a caller is, what they may touch, and how that is enforced. Read before
writing a dal function, a route, a Server Action, or anything that accepts an
id from the client. Every rule here was learned from a real bug.

## Two identities, never mixed (when there is an admin panel)

| | User | Admin |
|---|---|---|
| Table | `User` | `Admin` (+ `AdminPermission`) |
| Cookie | `auth-token` | `admin_token` |
| Session | `{ userId: number }` | `{ adminId, role, isActive }` |
| Guards (`@/server/auth`) | `getSession()`, `requireAuth()`, `requireUserId()` | `requireAdmin()`, `requireAdminPermission(page, access)`, `requireSuperAdmin()` |
| Factories | `defineAction`, `defineRoute({ auth: 'user' })` | `defineAdminAction({ page, access })`, `defineRoute({ auth: { admin: { page } } })` |

- An admin is not a user with a role; nothing admin goes through the user session.
- Sessions are started/ended only in `features/auth` (via `@/server/session`)
  and read only in `@/server/auth`.
- `userId` is a `number` everywhere.

## Rule 1 — identity comes from the session, never from input

Never take "who is asking" from a query string, a body, a path param, a
cookie the client writes, a hidden form field, or an argument a language
model fills in. Read `session.userId` / `admin.adminId`.

Real instances of this bug: a `userId` query param on a progress route; a
quiz route that leaked answer keys to anyone passing another `userId`; a
client-written cookie used as an auth fallback; an AI agent's memory tool
whose `userId` argument was model output — one chat message could rewrite
another user's profile. **Model output is user input.**

When the client sends an id, it names a *thing*; the dal checks the thing
belongs to (or is visible to) the caller.

## Rule 2 — the check lives in the dal

`defineRoute({ auth })` and `defineAdminAction({ page })` are fast filters.
The guarantee is the `require*` call **inside the dal function**: a server
component, an action, a route and a cron job can reach the same function, and
only one of them passes through any given route.

- **Every dal function that writes starts by resolving identity** —
  `requireUserId()`, `requireAdminPermission(page, 'full')`. Review the
  function body, not its caller.
- Sanctioned exceptions, each saying so in a comment: a public form that runs
  before an account exists (signup/registration), and system work exported
  only through `system.ts` (cron).
- Declaring the check in both factory and dal is correct and free (session
  reads are `cache()`d).

## Sockets

The same three rules, applied to Socket.IO events (`src/realtime/handlers.ts`):

- **Identity** is `socket.data.actor`, read once at handshake from the session
  cookie. No event carries "who": a `userName` in a payload is ignored
  (`realtime/handlers.test.ts` sends one and checks it).
- **Authority** is checked per event: signed in; not restricted (terms of use
  or a warning waiting — `checkRestriction`); seated at the table the payload
  names for in-game events; staff power re-read, never trusted from the client.
- **Payloads** are parsed with the feature's Zod input and dropped, never
  half-applied, when they do not parse. Events named like Socket.IO's own
  (`disconnect`, `error`…) are dropped before dispatch, and a connection that
  sends more than 100 events in 5 seconds is ignored until the window ends.
- **Game state** reaches a player only through `secureGame` and their own
  `playersState`; `game.private` never leaves the process.

## Rule 3 — scope a child write to its parent

`/admin/things/1/faqs/99` carries two ids. A write by the child id alone lets
any parent's page edit FAQ 99. This was found 23 times in one codebase — the
author had parsed the parent id and then not used it.

```ts
const { count } = await prisma.thingFaq.updateMany({
  where: { id: faqId, thingId },   // both ids
  data: input,
});
if (count === 0) throw new NotFoundError('سوال یافت نشد');
```

A `findFirst({ where: { id, parentId } })` immediately before a singular
`update` is equally correct. Same for ids inside a payload: a `challengeId`
submitted for a contest must belong to that contest. For user-owned rows add
the owner too: `{ id, postId, userId }`.

ESLint cannot catch this (a selector for it fired 89 times on correct code) —
it is a review item.

## Admin permissions (page-path RBAC)

- `AdminPermission(adminId, pagePath, accessLevel: none|read|full)`. Valid
  paths are `ADMIN_PAGE_PATHS` in `src/lib/admin-pages.ts` → typed
  `AdminPagePath`; a typo is a compile error, adding a page needs no migration.
- `read` accepts read|full; `full` only full. **Writing needs `full`.**
  `defineAdminAction` defaults to `'full'`; list actions say `access: 'read'`.
  `defineRoute({ auth: { admin } })` defaults to `'read'`.
- A super admin passes every page check.
- **Managing admins is the privilege-escalation surface** — creating,
  editing, deleting admins, changing roles, rewriting permissions: those use
  `superAdmin: true`, never a page. Super admin accounts are provisioned
  outside the panel; `assertAdminIsManageable` refuses to modify one.
- **`/admin/*` URLs are frozen** — renaming one silently revokes every
  permission row for it.
- Client permission contexts/hooks only decide what the UI draws; the server
  never trusts them.
- Role-like access that is not a page (a judge assigned to a contest) is
  checked in the dal against the assignment row.

## What leaves the server

- **Explicit `select` + mapper — never return or spread a whole row.** A
  spread ships every future column; an admin route once returned
  `passwordHash`, `otp` and a reset token this way.
- **Admin and user data are separate DTOs and separate functions**
  (`getPost` / `getPostForAdmin`), never one DTO with optional admin-only
  fields — a forgotten branch ships `costPrice` to a customer.
- **Errors:** throw `AppError` subclasses with a user-language message;
  anything else becomes a generic `InternalError`. Never echo `error.message`
  or database text.
- **Never value-import `@prisma/client` in client-reachable code** — the
  browser index carries every model's field map. Enums via `@/lib/prisma-enums`.
- **Reveal account state only after the credential is verified.** Wrong
  password and unknown account get the same message and the same hashing
  cost; "inactive"/"unverified" is said only after a correct password.
- One-time codes: `crypto.randomInt`, constant-time compare, consumed
  atomically (`updateMany` conditioned on the code → `count`), so two
  concurrent requests cannot both use one code.
- Private user files: private ACL, served only through short-lived signed
  URLs after the dal authorizes; a submitted file URL must be the caller's own
  upload or the value already stored. Scan uploaded archives for secrets
  (`.env`, keys) if users upload project files.

## Rate limits

Named in `src/server/rate-limits.ts`, enforced via `defineRoute({ rateLimit })`,
`defineAction({ rateLimit })` or `enforceRateLimit(name, subject?)`. A new
abuse-prone endpoint gets a named limit: anything that sends SMS or email,
calls a model, takes money, uploads, or accepts a code/password without a
session. Credential checks: per-IP and per-account buckets. Cost ceilings:
`by: 'global'`. Counters are in-process (reset on deploy, per instance).
Details: `server-infrastructure.md`.

## Cron, webhooks, callbacks

- Cron routes: `defineRoute({ auth: 'cron' })` (`Authorization: Bearer
  $CRON_SECRET`), calling `features/<x>/system`.
- Platform-wide work (`…ForUser(userId)`, queue flushes) lives in the
  feature's `system.ts`, importable only from `src/app/api/cron/**` (lint).
- Payment callbacks are `auth: 'none'` routes (the gateway redirects the
  browser). **Confirm with the provider's verify API**; never trust amounts
  or statuses from the callback. Verify webhook signatures; log rejections
  with `logSecurityEvent(SECURITY_WEBHOOK_REJECTED)`.

## Secrets and configuration

- Server secrets only through `env` (`@/server/env`). Only `NEXT_PUBLIC_*`
  reaches the browser.
- **Never write a credential into a tracked file** — code, docs, specs, seed
  scripts, `.claude/settings.local.json`. Commit `.env.example` only.
- `proxy.ts`/`middleware.ts` is not an auth boundary (CVE-2025-29927).

## LLM features

- The agent has **no database access**. Its tools write through a store the
  dal builds for the signed-in user; no tool takes a user or record id.
- Who may use the model is decided once, in the dal, and the chat route
  applies it before anything else. Per-user rate limit + global ceiling.

## Audit events

`logEvent` / `logSecurityEvent` (`@/server/events`) record sign-ups, sign-ins,
failed sign-ins, OTP sends, password resets, admin logins, permission
changes, deletions, payments. A new sensitive admin operation logs an event.

## Manual checks (no automated authz test)

- Walk the real path in a browser, as a user and in the admin panel.
- **Horizontal access:** with two real accounts, show that user B can neither
  read nor modify user A's data. Name the accounts and the path tested.

## Known gaps to decide per project

- Sessions are not invalidated on password change unless a `tokenVersion` /
  `passwordChangedAt` column is checked in `getSession`. Decide early.
