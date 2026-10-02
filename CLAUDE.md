# Grand Mafia — project memory

## Overview
A Persian (RTL) online version of the social-deduction board game Secret
Hitler ("هیتلر مخفی"), forked from Secret Hitler.io and being rewritten from
Express + MongoDB + React 16 onto Next.js 16. The game's rules and flow stay
as they were (the engine is a faithful port). The look does not: the product
owner asked for a new, modern, mobile-first design in the spirit of
secret-hitler.online (Lalezar for headings, Vazirmatn for text; see
docs/design.md).

## Documentation
Standing rules live in `AGENTS.md` and `docs/` (English). Before working on an
area, open its document:

| Document | Read it when |
|---|---|
| [AGENTS.md](AGENTS.md) | Always — the enforced rules, project decisions, review items, definition of done |
| [docs/migration.md](docs/migration.md) | Porting anything from `legacy/` — phases and status |
| [docs/architecture.md](docs/architecture.md) | Adding a file, page, route or action; deciding where code goes |
| [docs/security.md](docs/security.md) | Anything that reads a session, takes an id, or checks a permission |
| [docs/data.md](docs/data.md) | Queries, schema, validation, caching |
| [docs/observability.md](docs/observability.md) | Logging, events, errors, health |
| [docs/design.md](docs/design.md) | Building or changing UI |
| [docs/domain.md](docs/domain.md) | A product term needs tracing to code |

The `nextjs-architecture` skill (`.claude/skills/`) holds the generic
architecture and templates; this project's docs win where they differ.

## Tech stack
- Next.js 16 (App Router, `cacheComponents` on), React 19, TypeScript strict
- Custom server (`server.ts`): Next + Socket.IO 4 in one Node process
- PostgreSQL + Prisma 7 (`pg` adapter); Zod 4 via `@/lib/validation`
- pino logging, in-process rate limiting, vitest for the game engine
- UI: hand-built components in `src/components/ui` + Tailwind CSS 4; fonts Lalezar (display) and Vazirmatn (text), self-hosted

## Checks
`pnpm typecheck`, `pnpm lint`, `pnpm test`; `pnpm build` for boundary/caching/config changes.

## Conventions
- User-facing text: Persian. Code comments: English.
- Never modify design tokens (`src/app/globals.css`) to style one thing; use `src/components/ui` first.
