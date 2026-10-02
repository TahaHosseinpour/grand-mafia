/**
 * Named rate limits — the numbers only. Enforcement is in `rate-limit.ts`, so
 * tuning a number never touches logic. No imports, readable at a glance.
 *
 * `by` says what a limit counts:
 *   'ip'      — per client IP. The default for anonymous endpoints.
 *   'user'    — per signed-in user id (falls back to IP when anonymous).
 *   'subject' — per caller-supplied key (a mobile number, an invite code).
 *               The call site must pass it; forgetting is a compile error.
 *   'global'  — one bucket for the whole platform: a ceiling on a shared cost
 *               (SMS bill, LLM tokens). Crossing it logs an error and alerts.
 *
 * Every limit carries a comment saying why its number is what it is. Never
 * loosen or "re-derive" a number during a refactor — that is how a limit
 * silently stops protecting anything.
 *
 * What needs a limit: anything that sends SMS or email, calls a model, takes
 * money, uploads files, or accepts a code/password without a session. Not
 * every action — a limit on a plain read only annoys real users.
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
  // Each credential check has two buckets: per IP, and per account (subject)
  // so rotating IPs buys no extra guesses against one account.
  LOGIN: { windowMs: MINUTE, maxRequests: 5, by: 'ip' },
  LOGIN_ACCOUNT: { windowMs: MINUTE, maxRequests: 5, by: 'subject' },
  ADMIN_LOGIN: { windowMs: MINUTE, maxRequests: 3, by: 'ip' },
  ADMIN_LOGIN_ACCOUNT: { windowMs: MINUTE, maxRequests: 3, by: 'subject' },
  REGISTER: { windowMs: 10 * MINUTE, maxRequests: 3, by: 'ip' },
  PASSWORD_RESET: { windowMs: 10 * MINUTE, maxRequests: 3, by: 'ip' },
  PASSWORD_RESET_ACCOUNT: { windowMs: 10 * MINUTE, maxRequests: 3, by: 'subject' },

  // ---- One-time codes: every send costs money --------------------------
  // Keyed on the normalised mobile, whatever IP the request comes from.
  OTP_SEND_COOLDOWN: { windowMs: MINUTE, maxRequests: 1, by: 'subject' },
  OTP_SEND: { windowMs: 5 * MINUTE, maxRequests: 3, by: 'subject' },
  OTP_SEND_DAILY: { windowMs: DAY, maxRequests: 10, by: 'subject' },
  OTP_SEND_IP: { windowMs: 5 * MINUTE, maxRequests: 3, by: 'ip' },
  // Platform-wide ceiling against SMS pumping spread over many numbers/IPs.
  // Size it at several times a busy launch day; it should only trip under attack.
  OTP_SMS_GLOBAL_DAILY: { windowMs: DAY, maxRequests: 2000, by: 'global' },
  // A 6-digit code: the brute-force surface.
  OTP_VERIFY: { windowMs: MINUTE, maxRequests: 5, by: 'ip' },
  OTP_VERIFY_ACCOUNT: { windowMs: MINUTE, maxRequests: 5, by: 'subject' },

  // ---- Costly operations -----------------------------------------------
  PAYMENT_CREATE: { windowMs: MINUTE, maxRequests: 5, by: 'user' },
  UPLOAD: { windowMs: MINUTE, maxRequests: 20, by: 'user' },
  // Each call costs LLM tokens; the caller is signed in, so per user, not a shared NAT IP.
  LLM_CHAT: { windowMs: MINUTE, maxRequests: 20, by: 'user' },
  // Public form that sends a real email per call.
  SEND_EMAIL: { windowMs: 10 * MINUTE, maxRequests: 3, by: 'ip' },

  // ---- User-generated content ------------------------------------------
  // Caps a comment flood from one account; a real reader never meets it.
  COMMENT: { windowMs: 10 * MINUTE, maxRequests: 10, by: 'user' },

  // ---- Guessable codes -------------------------------------------------
  DISCOUNT_VALIDATE: { windowMs: MINUTE, maxRequests: 5, by: 'ip' },
  INVITE_JOIN: { windowMs: MINUTE, maxRequests: 10, by: 'ip' },

  // ---- General ---------------------------------------------------------
  GENERAL: { windowMs: MINUTE, maxRequests: 100, by: 'ip' },
} satisfies Record<string, RateLimitConfig>;

export type RateLimitName = keyof typeof RATE_LIMITS;

/** Names keyed on a caller-supplied subject: `enforceRateLimit` requires the subject for these. */
export type SubjectKeyedLimit = {
  [K in RateLimitName]: (typeof RATE_LIMITS)[K]['by'] extends 'subject' ? K : never;
}[RateLimitName];
