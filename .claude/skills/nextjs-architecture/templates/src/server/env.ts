import 'server-only';
import { z } from '@/lib/validation';

/**
 * Environment variables, validated in one place.
 *
 * Every server read goes through `env.X`. Two failure modes this removes: a
 * typo that surfaces at runtime instead of at the first read, and `|| ''`
 * turning a missing key into an empty string that stays silent until the
 * first real call to the service.
 *
 * **Server only.** `NEXT_PUBLIC_*` variables do not belong here — Next inlines
 * them into the client bundle at build time, so they must stay written as
 * `process.env.NEXT_PUBLIC_X`.
 *
 * Add a variable: one line in `schema`, then read `env.NAME`. Mark a key
 * `optional()` only when the app genuinely works without it.
 */

/** Non-empty string; surrounding whitespace is trimmed. */
const required = (what: string) =>
  z.string({ error: `${what} تنظیم نشده است` }).trim().min(1, `${what} تنظیم نشده است`);

const optional = () =>
  z
    .string()
    .trim()
    .min(1)
    .optional()
    // A variable set to an empty value is the same as not set.
    .catch(undefined);

const url = (what: string) =>
  required(what)
    .refine((v) => /^https?:\/\//.test(v), `${what} باید با http:// یا https:// شروع شود`)
    // A base URL never ends in a slash, so `${base}/api/x` cannot double up.
    .transform((v) => v.replace(/\/+$/, ''));

const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  LOG_LEVEL: optional(),

  DATABASE_URL: required('DATABASE_URL'),

  // Auth. ADMIN_JWT_SECRET is optional; when absent admin tokens are signed
  // with JWT_SECRET. Setting it is better: leaking the user secret then does
  // not also hand over the admin panel.
  JWT_SECRET: required('JWT_SECRET'),
  ADMIN_JWT_SECRET: optional(),

  // Bearer token every cron route checks (`defineRoute({ auth: 'cron' })`).
  CRON_SECRET: required('CRON_SECRET'),

  // The one canonical base URL; `appUrl()` below is the only reader.
  BASE_URL: url('BASE_URL'),

  // ---- Project-specific services ---------------------------------------
  // Storage, SMS, email, payment gateway, LLM keys… one line each.
  // SMS_API_KEY: required('SMS_API_KEY'),
});

export type Env = z.infer<typeof schema>;

/**
 * Lazy, not a module-level `schema.parse()`.
 *
 * `next build` imports every route and page to collect metadata. Validating
 * at import time would fail the build on any machine without production
 * secrets (CI included). Lazy means the first *read* validates, at runtime.
 * Only a successful parse is cached, so a fixed `.env` is seen on the next
 * read (which is what lets the health check recover).
 */
let cached: Env | null = null;

function load(): Env {
  const parsed = schema.safeParse(process.env);

  if (!parsed.success) {
    // One line per variable. This error only reaches the server log.
    const lines = parsed.error.issues.map(
      (issue) => `  ${issue.path.join('.') || '(root)'}: ${issue.message}`
    );
    throw new Error(`[ENV] invalid environment:\n${lines.join('\n')}`);
  }

  return parsed.data;
}

export function getEnv(): Env {
  return (cached ??= load());
}

/**
 * Write `env.DATABASE_URL`, not `getEnv().DATABASE_URL`.
 *
 * A Proxy, so reading any key triggers validation at that moment while
 * importing this module stays free.
 */
export const env = new Proxy({} as Env, {
  get: (_target, key: string) => getEnv()[key as keyof Env],
  has: (_target, key: string) => key in getEnv(),
  ownKeys: () => Reflect.ownKeys(getEnv()),
  getOwnPropertyDescriptor: (_target, key) => Reflect.getOwnPropertyDescriptor(getEnv(), key),
});

/** The application's only canonical base URL. No trailing slash. */
export const appUrl = () => getEnv().BASE_URL;

export const isProduction = () => getEnv().NODE_ENV === 'production';
export const isDevelopment = () => getEnv().NODE_ENV === 'development';
