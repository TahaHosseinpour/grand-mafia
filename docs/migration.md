# Migration from `legacy/`

The pre-rewrite app (Express 4 + Pug + Passport + MongoDB/Mongoose + Redis +
Socket.IO 2 + React 16/Redux + Semantic UI + Sass) is kept in `legacy/` and is
the reference for every port. It is deleted when the last phase lands.

## Goals (from the product owner)

1. Persian UI, font Vazirmatn, RTL.
2. Stack: Next.js 16 + TypeScript + Prisma + PostgreSQL + Tailwind.
3. Reusable component structure.
4. **The look and the flow of the game do not change** — only Persian and
   responsive layouts.

## Decisions

| Topic | Decision |
|---|---|
| Hosting | VPS, one Node process: `server.ts` hosts Next and Socket.IO |
| Sign-in | Username + password, email verification, password reset by email. Discord/GitHub OAuth dropped |
| Kept beyond the core | Moderation + reports, ranking (ELO/seasons/leaderboards/badges), cosmetics (cardbacks, emotes, Flappy Hitler, changelog) |
| Dropped | Game replay (and the `/gameSummary`, `/gameJSON` endpoints serving it) |
| Translation | Direct translation of the original terms; card/board images keep their English text for now |
| Data | Fresh PostgreSQL database; no MongoDB import (the fork has no production data) |
| Usernames | Same rule as legacy: Latin letters and digits, 3–16 characters |
| Passwords | bcrypt (legacy passport-local-mongoose hashes are not carried over) |
| Sessions | Signed JWT in an httpOnly cookie (legacy: express-session in Redis/Mongo) |
| Global settings | `global_settings` table (legacy: Redis db 11) |
| Error reporting | pino only (no Sentry) |

## Mapping

| Legacy | New home |
|---|---|
| `app.js`, `bin/dev.js` | `server.ts`, `src/realtime/server.ts`, `next.config.ts` |
| `routes/index.js` (pages) | `src/app/**/page.tsx` |
| `routes/accounts.js`, `routes/verification.js` | `src/features/auth` |
| `views/*.pug` | `src/app/(site)/**` |
| `models/*.js` (Mongoose) | `prisma/schema.prisma` |
| `routes/socket/game/*` | `src/features/games/engine/*` (pure TS, unit-tested) |
| `routes/socket/user-events/*`, `user-requests.js`, `routes.js` | `src/realtime/handlers/*` → feature dals |
| `routes/socket/models.js` (in-memory state) | `src/features/games/engine/store.ts` |
| `routes/socket/user-events/moderation.js`, `mod-*`, `report.js`, `player-reports.js` | `src/features/moderation` |
| `routes/socket/badges.js`, `models/profile`, ELO in `end-game.js` | `src/features/ranking` |
| `routes/socket/user-events/chat.js` (general chat) | `src/features/chat` |
| `src/frontend-scripts/components/**` | `src/features/*/components/**` + `src/components/ui/**` |
| `src/frontend-scripts/reducers`, `sagas`, `actions` | a client store in `src/features/games/components/store` |
| `src/scss/**`, Semantic UI | Tailwind tokens in `src/app/globals.css` + `src/components/ui` |
| `public/images`, `public/sounds` | `public/` (moved, same URLs) |

## Phases and status

- [x] **0 — Foundation.** Next 16 + TS strict + Prisma 7 + PostgreSQL + Tailwind 4,
  Vazirmatn, RTL root layout, `src/server` infrastructure, ESLint guards,
  custom server with Socket.IO handshake auth, health check, CI.
- [x] **1 — Accounts.** Prisma schema in use; sign-up/in/out (IP-ban checks,
  signups log, 88/blocked-word/disposable-email rules), email verification,
  password reset, account page; Persian pages: home, rules, how to play,
  terms, about; stats is a placeholder until phase 4. `/game` and `/observe`
  are placeholders until phase 3. Verified in a browser against the legacy
  screenshots (desktop + phone width).
- [ ] **2 — Game engine.** Port `routes/socket/game/**` and the lobby/seat
  events to TypeScript with the same event names and payloads; vitest suite
  over the rules; finished games persisted.
- [ ] **3 — Game client.** Lobby, create game, the table (tracks, players,
  cards, votes, powers), game chat, general chat, player list, settings,
  profile — Persian, responsive, Tailwind components matching the legacy look.
- [ ] **4 — Ranking.** ELO/XP updates, seasons, leaderboards, badges, profile stats.
- [ ] **5 — Moderation.** Moderation panel, reports, signups, mod DMs, bans/timeouts.
- [ ] **6 — Cosmetics.** Cardback upload, emotes, Flappy Hitler, changelog.
- [ ] **7 — Cleanup.** Delete `legacy/`; final visual pass against screenshots.
