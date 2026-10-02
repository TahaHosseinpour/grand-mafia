import 'server-only';
import pino from 'pino';
import { getContext } from './log-context';

/**
 * The server logger.
 *
 * `console.*` is a lint error across `src/`. Server code logs with `log()`;
 * client code does not log at all — a genuine user-facing failure calls
 * `Sentry.captureException` instead.
 *
 * **No `transport`.** `pino-pretty` as a transport spawns a worker thread,
 * which breaks under `output: 'standalone'`. Raw JSON is printed in every
 * environment; prettifying is a separate script:
 *
 *     "dev:pretty": "next dev | npx pino-pretty"
 *
 * Levels: `error` = a bug or an unexpected failure; `warn` = expected but
 * worrying (rate limit hit, forbidden access, rejected webhook); `info` =
 * business events; `debug` = development detail. An expected `AppError`
 * (401/404/409) is never `error`, or real alarms drown in noise.
 */

/**
 * Keys that must never land in a log line. pino matches paths exactly, so
 * every shape a secret may appear in is listed. `*` = any key at that depth.
 */
const redactPaths = [
  'password',
  'passwordHash',
  'currentPassword',
  'newPassword',
  'token',
  'otp',
  'accessToken',
  'refreshToken',
  'authorization',
  'cookie',
  'secret',
  'apiKey',
  '*.password',
  '*.passwordHash',
  '*.token',
  '*.otp',
  '*.secret',
  '*.apiKey',
  'req.headers.cookie',
  'req.headers.authorization',
  'headers.cookie',
  'headers.authorization',
  'body.password',
  'body.currentPassword',
  'body.newPassword',
  'body.otp',
  'body.token',
];

const base = pino({
  level: process.env.LOG_LEVEL ?? (process.env.NODE_ENV === 'production' ? 'info' : 'debug'),
  redact: { paths: redactPaths, censor: '[redacted]' },
  // ISO timestamps are easier to grep than epoch milliseconds.
  timestamp: pino.stdTimeFunctions.isoTime,
  formatters: {
    // `level: "info"` instead of `level: 30`.
    level: (label) => ({ level: label }),
  },
});

/**
 * A logger bound to the current request context: `requestId`, `userId`,
 * `adminId` and `route` are attached to every line, so one request can be
 * reconstructed with `grep <requestId>`. Always call this, not `rootLogger`.
 */
export function log() {
  const context = getContext();
  return context ? base.child(context) : base;
}

/** For places with genuinely no request: boot, scripts. */
export const rootLogger = base;

export type Logger = pino.Logger;
