# Domain

Every product concept, the feature that owns it, and where it lives.
Grows as features are ported (see `migration.md`).

## Actors

| Actor | What it is |
|---|---|
| Player | A signed-in `User`. Sits in games, chats, has ELO/XP and settings. |
| Observer | Anyone at `/observe` without signing in: watches the lobby and games, cannot chat or sit. |
| Staff | A `User` with a `staffRole` (`admin` > `editor` > `moderator` > `altmod`/`trialmod`; `veteran`/`contributor` are cosmetic). Moderates from inside the game client. |

## Concepts

| Concept (فارسی) | Feature | Storage |
|---|---|---|
| Account (حساب کاربری) | `users` | `users` |
| Session | `auth` (+ `src/server/session.ts`) | signed cookie `auth-token` |
| Email verification / password reset | `auth` | `email_tokens` (hashed tokens) |
| Game settings (تنظیمات بازی) | `users` | `users.game_settings` (JSON) |
| Live game, seats, votes, policies | `games` | engine memory |
| Finished game record | `games` | `games` |
| General chat (چت عمومی) | `chat` | memory (last N messages) |
| ELO / XP / seasons / leaderboards | `ranking` | `users`, `season_stats`, `elo_snapshots` |
| Badges (نشان‌ها) | `ranking` | `badges` |
| Profile statistics | `ranking` | `profiles` |
| Ban / timeout / IP ban | `moderation` | `users`, `banned_ips`, `mod_actions` |
| Player report (گزارش) | `moderation` | `player_reports` |
| Mod DM thread | `moderation` | `mod_threads` |
| Custom cardback | `cosmetics` | file in `UPLOADS_DIR` + `users.game_settings.customCardback` |
