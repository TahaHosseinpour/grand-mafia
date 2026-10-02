import 'server-only';
import { getClientIp } from './client-ip';
import { RATE_LIMITS, type RateLimitConfig, type RateLimitName, type SubjectKeyedLimit } from './rate-limits';
import { RateLimitError } from './errors';
import { EVENTS, logSecurityEvent } from './events';
import { log } from './logger';

/**
 * In-process rate limiter.
 *
 * State lives in a Map in this process. Sound for one Node process behind a
 * reverse proxy, but counters reset on every restart/deploy and are **per
 * instance** — scaling out multiplies every limit. This module is the single
 * place to swap for a shared store (Redis/Upstash) when that day comes;
 * callers and `rate-limits.ts` do not change.
 *
 * Applied at the entry layer only — `defineRoute({ rateLimit })`,
 * `defineAction({ rateLimit })`, or `enforceRateLimit()` inside a dal step
 * that sends SMS. Never as a blanket rule in the dal: a Server Component
 * calling the same read would be throttled too.
 */

interface RateLimitEntry {
  count: number;
  resetTime: number;
}

const store = new Map<string, RateLimitEntry>();

// Keys include caller-supplied values (mobile numbers), so expired entries are
// swept or the Map grows without bound.
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of store.entries()) {
    if (entry.resetTime < now) store.delete(key);
  }
}, 60_000).unref();

export interface RateLimitResult {
  success: boolean;
  remaining: number;
  resetTime: number;
  /** Seconds until reset; only when `success` is false. */
  retryAfter?: number;
}

/** Low-level primitive. Prefer `enforceRateLimit`. */
export function checkRateLimit(
  identifier: string,
  config: { windowMs: number; maxRequests: number }
): RateLimitResult {
  const now = Date.now();
  const entry = store.get(identifier);

  if (!entry || entry.resetTime < now) {
    store.set(identifier, { count: 1, resetTime: now + config.windowMs });
    return { success: true, remaining: config.maxRequests - 1, resetTime: now + config.windowMs };
  }

  if (entry.count >= config.maxRequests) {
    return {
      success: false,
      remaining: 0,
      resetTime: entry.resetTime,
      retryAfter: Math.ceil((entry.resetTime - now) / 1000),
    };
  }

  entry.count++;
  return { success: true, remaining: config.maxRequests - entry.count, resetTime: entry.resetTime };
}

function retryMessage(seconds: number): string {
  const minutes = Math.ceil(seconds / 60);
  let time: string;
  if (seconds < 60) time = `${seconds} ثانیه`;
  else if (minutes < 60) time = `${minutes} دقیقه`;
  else time = `${Math.ceil(minutes / 60)} ساعت`;
  return `درخواست‌های شما بیش از حد مجاز است. لطفاً ${time} دیگر تلاش کنید.`;
}

const GLOBAL_CEILING_MESSAGE = 'این سرویس موقتاً در دسترس نیست. لطفاً کمی بعد دوباره تلاش کنید.';

/** The window (by reset time) each global ceiling was last reported for. */
const reportedCeilings = new Map<string, number>();

/**
 * A platform-wide ceiling was crossed: one error log line per window — not
 * once per refused request, which under attack would be thousands.
 */
function reportCeilingReached(name: RateLimitName, resetTime: number): void {
  if (reportedCeilings.get(name) === resetTime) return;
  reportedCeilings.set(name, resetTime);
  const resetsAt = new Date(resetTime).toISOString();
  log().error({ limit: name, resetsAt }, 'platform-wide rate ceiling reached');
}

/**
 * Applies a named limit; throws `RateLimitError` when exceeded, so the 429 and
 * its `Retry-After` header are built once, in the factories.
 *
 * The overloads make `subject` required for exactly the `by: 'subject'` rules,
 * so an OTP limit cannot be called without the mobile number and quietly
 * degrade to an IP bucket.
 */
export async function enforceRateLimit(name: SubjectKeyedLimit, subject: string): Promise<void>;
export async function enforceRateLimit(
  name: Exclude<RateLimitName, SubjectKeyedLimit>,
  subject?: string
): Promise<void>;
export async function enforceRateLimit(name: RateLimitName, subject?: string): Promise<void> {
  const config: RateLimitConfig = RATE_LIMITS[name];

  let key: string;
  if (config.by === 'global') {
    key = 'all';
  } else if (config.by === 'subject' || (config.by === 'user' && subject)) {
    key = subject ?? (await getClientIp());
  } else {
    key = await getClientIp();
  }

  const result = checkRateLimit(`${name}:${key}`, config);
  if (result.success) return;

  const retryAfter = result.retryAfter ?? 60;
  // The key is left out on purpose: it is an IP address or a mobile number.
  logSecurityEvent(EVENTS.SECURITY_RATE_LIMIT, { limit: name, by: config.by, retryAfter });

  if (config.by === 'global') {
    reportCeilingReached(name, result.resetTime);
    // Not the caller's fault, so not "your requests", and no countdown.
    throw new RateLimitError(GLOBAL_CEILING_MESSAGE, {
      retryAfter,
      remaining: result.remaining,
      resetTime: result.resetTime,
    });
  }

  throw new RateLimitError(retryMessage(retryAfter), {
    retryAfter,
    remaining: result.remaining,
    resetTime: result.resetTime,
  });
}
