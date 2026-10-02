import 'server-only';
import { log } from './logger';

/**
 * Domain events with fixed names: `<domain>.<action>`.
 *
 * A free-form log message is for a human to read; an event is for counting.
 * With free strings, three months later `payment_ok`, `payment.success` and
 * `paymentVerified` live side by side and no dashboard can be built on them.
 * The list is closed: a new event is a new line here, and a typo is a compile
 * error rather than a lost event.
 *
 * Events are logged from the dal, beside the write — only the dal knows what
 * actually happened. The dal never logs *errors*; it throws, and the
 * route/action factory logs them once.
 */
export const EVENTS = {
  // Auth
  AUTH_SIGNUP: 'auth.signup',
  AUTH_LOGIN: 'auth.login',
  AUTH_LOGIN_FAILED: 'auth.login_failed',
  AUTH_OTP_SENT: 'auth.otp_sent',
  AUTH_PASSWORD_RESET: 'auth.password_reset',

  // Admin — every sensitive admin operation logs one
  ADMIN_LOGIN: 'admin.login',
  ADMIN_PERMISSION_CHANGED: 'admin.permission_changed',
  ADMIN_USER_DELETED: 'admin.user_deleted',

  // Payments
  PAYMENT_CREATED: 'payment.created',
  PAYMENT_VERIFIED: 'payment.verified',
  PAYMENT_FAILED: 'payment.failed',

  // Content
  CONTENT_PUBLISHED: 'content.published',
  CONTENT_DELETED: 'content.deleted',

  // Security — always `warn`
  SECURITY_RATE_LIMIT: 'security.rate_limit',
  SECURITY_FORBIDDEN: 'security.forbidden',
  SECURITY_WEBHOOK_REJECTED: 'security.webhook_rejected',
} as const;

export type EventName = (typeof EVENTS)[keyof typeof EVENTS];

/**
 * Values allowed in an event payload. Deliberately narrow: a Prisma row
 * dropped into an event puts the whole record — password hash included — in
 * the log. Pick fields explicitly.
 */
type EventValue = string | number | boolean | null | undefined;

export function logEvent(event: EventName, data?: Record<string, EventValue>): void {
  log().info({ event, ...data }, event);
}

/** Security events are `warn`: they should raise an alarm, not hide in `info`. */
export function logSecurityEvent(
  event:
    | typeof EVENTS.SECURITY_RATE_LIMIT
    | typeof EVENTS.SECURITY_FORBIDDEN
    | typeof EVENTS.SECURITY_WEBHOOK_REJECTED,
  data?: Record<string, EventValue>
): void {
  log().warn({ event, ...data }, event);
}
