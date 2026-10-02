# Migration from `legacy/`

The pre-rewrite app (Express 4 + Pug + Passport + MongoDB/Mongoose + Redis +
Socket.IO 2 + React 16/Redux + Semantic UI + Sass) is kept in `legacy/` and is
the reference for every port. It is deleted when the last phase lands.

## Goals (from the product owner)

1. Persian UI, font Vazirmatn, RTL.
2. Stack: Next.js 16 + TypeScript + Prisma + PostgreSQL + Tailwind.
3. Reusable component structure.
4. ~~The look and the flow of the game do not change~~ — the **flow** (rules,
   events, options) is unchanged. The **look** was replaced in phase 3 at the
   product owner's request: a modern, mobile-first design in the spirit of
   secret-hitler.online, uniform across the site (see `docs/design.md`).

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
| General chat | Lives in `games` (`engine/player-chat.ts`), not `chat`: it needs the online list and shares flood control with the game chat. The `chat` slot stays reserved |

## Mapping

| Legacy | New home |
|---|---|
| `app.js`, `bin/dev.js` | `server.ts`, `src/realtime/server.ts`, `next.config.ts` |
| `routes/index.js` (pages) | `src/app/**/page.tsx` |
| `routes/accounts.js`, `routes/verification.js` | `src/features/auth` |
| `views/*.pug` | `src/app/(site)/**` |
| `models/*.js` (Mongoose) | `prisma/schema.prisma` |
| `routes/socket/game/*` | `src/features/games/engine/*` (pure TS, unit-tested) |
| `routes/socket/routes.js` | `src/realtime/{server,connection,handlers}.ts` |
| `routes/socket/user-events/*`, `user-requests.js`, `commands.js` | `src/features/games/engine/*` (lobby, join/create/remake, claims, chat, settings, restrictions, requests, commands) |
| `routes/socket/models.js` (in-memory state) | `src/features/games/engine/store.ts` |
| `routes/socket/user-events/moderation.js`, `mod-*`, `report.js`, `player-reports.js` | `src/features/moderation` |
| `routes/socket/badges.js`, `models/profile`, ELO in `end-game.js` | `src/features/ranking` |
| `routes/socket/user-events/chat.js` (general chat) | `src/features/games/engine/player-chat.ts` |
| `src/frontend-scripts/components/**` | `src/features/*/components/**` + `src/components/ui/**` |
| `src/frontend-scripts/reducers`, `sagas`, `actions` | a client store in `src/features/games/components/store` |
| `src/scss/**`, Semantic UI | Tailwind tokens in `src/app/globals.css` + `src/components/ui` |
| `public/images`, `public/sounds` | `public/` (moved, same URLs) |

## What phase 2 changed on purpose

The port keeps the flow. Where the legacy code was plainly wrong, it was fixed
rather than copied, and a test pins each fix:

| Legacy behaviour | Now |
|---|---|
| Avalon: the liberal and fascist role lists were shuffled *before* cutting them to the table size, so a small table could lose Merlin, Percival or Morgana (`start-game.js` sliced first — the port had inverted it, found by the Avalon test) | cut first, shuffle after |
| A game without game chat never cleared the pending chancellor after a rejected government, so nobody could be nominated again | cleared in every game |
| «Only email-verified players can sit» was shown in the lobby but never checked | checked when sitting |
| Saving any settings page change with no `isPrivate` in the payload counted as switching the profile to public | only an explicit `isPrivate` that differs counts |
| `getPlayerNotes` read the notes of whichever `userName` the client sent | the notes of the connected player |
| Any client could emit Socket.IO's own event names | dropped before dispatch; a flood limit per connection |

Dropped with the features they belonged to: tournaments, replay data, Discord
webhooks (reports and feedback go to the log and the database).

## Tests

`pnpm test` runs vitest. Data layers (`dal.ts`) are replaced by an in-memory
`src/test/world.ts` (`src/test/setup.ts`); everything above them is the real
code.

- `engine/full-game.test.ts` — bots (`src/test/bots.ts`) play 5–10 player
  games to the end on fake timers with seeded randomness, plus every game
  option (Avalon, Percival, monarchist, blind, timed, custom powers…). A game
  that stalls fails with the phase and the last actions.
- `engine/{lobby,settings,restrictions,connection,garbage,player-chat}.test.ts`
  — the rules around the table.
- `realtime/handlers.test.ts` — events through a fake Socket.IO, the way a
  browser sends them: who may send what, payload validation, reserved names,
  flood limit, a game played over the wire.
- `ranking/elo.test.ts`, `engine/line-guess.test.ts`, `lib/tou.test.ts`.

`pnpm smoke:game` is the end-to-end check against a real server and database.

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
- [x] **2 — Game engine and realtime.** `routes/socket/game/**`, the lobby and
  seat events, chat, claims, remakes, slash commands and the Socket.IO wiring
  are TypeScript, with the legacy event names and payloads (so the phase-3
  client can be ported 1:1). Persian game text. Finished games, Elo and XP
  are persisted. 182 vitest tests (see below) and `pnpm smoke:game` (five
  socket clients play a whole game against a running server and PostgreSQL).
  Deferred on purpose: staff-only slash commands and the moderation events
  (phase 5), badges and profile statistics (phase 4), cardback upload, Flappy
  Hitler and the changelog (phase 6).
- [x] **3 — Game client (redesigned).** `/game` and `/observe` are one client
  (`src/features/games/components`): lobby (tables, filters, online players,
  general chat — tabs on a phone), create game (every engine option, custom
  powers and deck), the table (board, seats, action sheets for every decision,
  role/peek/investigation reveals, claims, remake, leave, game chat), settings
  (privacy with its 18-hour rule, pronouns, bio, blacklist, staff options) and
  a profile card. The site pages share the design. Not yet: profile history,
  badges and charts (phase 4), moderator tools (phase 5), cardback upload,
  sounds, confetti (phase 6). The legacy theme colours and player-chosen
  theme are gone.
- [ ] **4 — Ranking.** ELO/XP updates, seasons, leaderboards, badges, profile stats.
- [ ] **5 — Moderation.** Moderation panel, reports, signups, mod DMs, bans/timeouts.
- [ ] **6 — Cosmetics.** Cardback upload, emotes, Flappy Hitler, changelog.
- [ ] **7 — Cleanup.** Delete `legacy/` and the legacy images in `public/images` nothing uses.
