# <Project name> — project memory

## Overview
<One paragraph: what the product is, who uses it, locale/direction (e.g. Persian, RTL).>

## Documentation
Standing rules live in `AGENTS.md` and `docs/` (English). Before working on an
area, open its document:

| Document | Read it when |
|---|---|
| [AGENTS.md](AGENTS.md) | Always — the enforced rules, review items, definition of done |
| [docs/architecture.md](docs/architecture.md) | Adding a file, page, route or action; deciding where code goes |
| [docs/security.md](docs/security.md) | Anything that reads a session, takes an id, or checks a permission |
| [docs/data.md](docs/data.md) | Queries, schema, validation, caching |
| [docs/observability.md](docs/observability.md) | Logging, events, errors, health |
| [docs/design.md](docs/design.md) | Building or changing UI |
| [docs/domain.md](docs/domain.md) | A product term needs tracing to code |

## Tech stack
- Next.js 16 (App Router, `cacheComponents` on), React 19, TypeScript strict
- PostgreSQL + Prisma; Zod 4 via `@/lib/validation`
- pino logging, Sentry, in-process rate limiting
- UI: <component library> + <styling> (the project's choice)

## Checks
`npx tsc --noEmit` and `npm run lint`; `npm run build` for boundary/caching/config changes.

## Conventions
- User-facing text: <LANGUAGE>. Code comments: English.
- Never modify design tokens to style one thing; use `src/components/ui` first.
