/**
 * Named rate limits — the numbers only. Enforcement is in `rate-limit.ts`, so
 * tuning a number never touches logic. No imports, readable at a glance.
 *
 * `by` says what a limit counts:
 *   'ip'      — per client IP. The default for anonymous endpoints.
 *   'user'    — per signed-in user id (falls back to IP when anonymous).
 *   'subject' — per caller-supplied key (a username, an email).
 *               The call site must pass it; forgetting is a compile error.
 *   'global'  — one bucket for the whole platform: a ceiling on a shared cost.
 *
 * Every limit carries a comment saying why its number is what it is. Never
 * loosen or "re-derive" a number during a refactor — that is how a limit
 * silently stops protecting anything.
 *
 * Socket.IO events are limited in the realtime layer (chat flood control is
 * game logic ported from the legacy engine), not here.
 */

export interface RateLimitConfig {
  windowMs: number;
  maxRequests: number;
  by: 'ip' | 'user' | 'subject' | 'global';
}

const MINUTE = 60 * 1000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

export const RATE_LIMITS = {
  // ---- Sign-in: brute-force surface ------------------------------------
  // Two buckets per credential check: per IP, and per account (username) so
  // rotating IPs buys no extra guesses against one account.
  LOGIN: { windowMs: MINUTE, maxRequests: 10, by: 'ip' },
  LOGIN_ACCOUNT: { windowMs: MINUTE, maxRequests: 5, by: 'subject' },
  // Account creation: a real person signs up once; this stops scripted alts.
  REGISTER: { windowMs: HOUR, maxRequests: 5, by: 'ip' },

  // ---- Email: every call sends a real message ---------------------------
  PASSWORD_RESET: { windowMs: 10 * MINUTE, maxRequests: 3, by: 'ip' },
  PASSWORD_RESET_ACCOUNT: { windowMs: 10 * MINUTE, maxRequests: 3, by: 'subject' },
  SEND_VERIFICATION: { windowMs: 10 * MINUTE, maxRequests: 3, by: 'user' },
  // Platform-wide ceiling on outgoing mail, against abuse spread over many IPs.
  EMAIL_GLOBAL_DAILY: { windowMs: DAY, maxRequests: 2000, by: 'global' },

  // ---- Account changes ---------------------------------------------------
  PASSWORD_CHANGE: { windowMs: 10 * MINUTE, maxRequests: 5, by: 'user' },
  // Cardback images are processed server-side; a few per minute is plenty.
  UPLOAD: { windowMs: MINUTE, maxRequests: 5, by: 'user' },
  FEEDBACK: { windowMs: HOUR, maxRequests: 5, by: 'user' },

  // ---- General ---------------------------------------------------------
  GENERAL: { windowMs: MINUTE, maxRequests: 100, by: 'ip' },
} satisfies Record<string, RateLimitConfig>;

export type RateLimitName = keyof typeof RATE_LIMITS;

/** Names keyed on a caller-supplied subject: `enforceRateLimit` requires the subject for these. */
export type SubjectKeyedLimit = {
  [K in RateLimitName]: (typeof RATE_LIMITS)[K]['by'] extends 'subject' ? K : never;
}[RateLimitName];
