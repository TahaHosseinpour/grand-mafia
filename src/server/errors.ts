import { unstable_rethrow } from 'next/navigation';

/**
 * Domain errors.
 *
 * The rule: the data and logic layers throw `AppError` and **never** build a
 * `Response`. Translation to HTTP happens only in `@/server/http` (routes) and
 * `@/server/action` (Server Actions), so a status code or a user-facing
 * message can be changed in one place.
 */

/** Stable error codes. Clients branch on these; the message text may change. */
export type ErrorCode =
  | 'UNAUTHORIZED'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'VALIDATION'
  | 'CONFLICT'
  | 'RATE_LIMITED'
  | 'INTERNAL'
  // A dependency the whole app needs (database, valid environment) is not
  // there. Sent as 503 by `api/health`.
  | 'UNAVAILABLE';
// Add a domain code only when a client must react differently to it — e.g.
// 'PAYMENT_PENDING' so a result page says "we are checking" instead of
// offering to pay twice.

export class AppError extends Error {
  readonly code: ErrorCode;
  readonly status: number;
  /** Field-level errors: `{ 'title': ['…'] }`. Forms mark fields from this. */
  readonly details?: Record<string, string[]>;
  /**
   * Is the message safe to show a user? `false` makes the HTTP layer
   * substitute a generic sentence, so internal detail (a table name, a
   * driver's error text) never reaches the browser.
   */
  readonly expose: boolean;

  constructor(
    message: string,
    options: {
      code: ErrorCode;
      status: number;
      details?: Record<string, string[]>;
      expose?: boolean;
      cause?: unknown;
    }
  ) {
    super(message, { cause: options.cause });
    this.name = new.target.name;
    this.code = options.code;
    this.status = options.status;
    this.details = options.details;
    this.expose = options.expose ?? true;

    // Without this, `instanceof` on Error subclasses breaks under some
    // transpile configurations.
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = 'لطفاً وارد شوید', cause?: unknown) {
    super(message, { code: 'UNAUTHORIZED', status: 401, cause });
  }
}

/**
 * 403 means "we know who you are, you may not do this" — not interchangeable
 * with 401. A deactivated account is this case: given a 401, the front end
 * bounces it to the login page in a loop.
 */
export class ForbiddenError extends AppError {
  constructor(message = 'شما دسترسی لازم برای این بخش را ندارید', cause?: unknown) {
    super(message, { code: 'FORBIDDEN', status: 403, cause });
  }
}

export class NotFoundError extends AppError {
  constructor(message = 'موردی یافت نشد', cause?: unknown) {
    super(message, { code: 'NOT_FOUND', status: 404, cause });
  }
}

export class ValidationError extends AppError {
  constructor(
    message = 'اطلاعات ارسالی معتبر نیست',
    details?: Record<string, string[]>,
    cause?: unknown
  ) {
    super(message, { code: 'VALIDATION', status: 400, details, cause });
  }
}

/** A state conflict: duplicate, capacity full, deadline passed, FK in use. */
export class ConflictError extends AppError {
  constructor(message = 'این عملیات در وضعیت فعلی امکان‌پذیر نیست', cause?: unknown) {
    super(message, { code: 'CONFLICT', status: 409, cause });
  }
}

/**
 * Carries `retryAfter` (seconds): the countdown message and the
 * `Retry-After` header both need it.
 */
export class RateLimitError extends AppError {
  readonly retryAfter: number;
  readonly remaining: number;
  readonly resetTime: number;

  constructor(message: string, info: { retryAfter: number; remaining?: number; resetTime?: number }) {
    super(message, { code: 'RATE_LIMITED', status: 429 });
    this.retryAfter = info.retryAfter;
    this.remaining = info.remaining ?? 0;
    this.resetTime = info.resetTime ?? Date.now() + info.retryAfter * 1000;
  }
}

/** An unexpected failure. The message is never shown to a user. */
export class InternalError extends AppError {
  constructor(message = 'خطای غیرمنتظره', cause?: unknown) {
    super(message, { code: 'INTERNAL', status: 500, expose: false, cause });
  }
}

export function isAppError(error: unknown): error is AppError {
  return error instanceof AppError;
}

/**
 * Re-throws Next's control-flow signals.
 *
 * `redirect()` and `notFound()` work by **throwing**. A `catch` that returns
 * a 500 swallows them and navigation silently stops working. Every catch
 * block in infrastructure calls this first.
 */
export function rethrowFrameworkErrors(error: unknown): void {
  unstable_rethrow(error);
}

/**
 * Coerces anything into an `AppError`.
 *
 * Anything that is not already an `AppError` is a bug, not a domain condition
 * — it becomes an `InternalError` with `expose: false`, and the original
 * survives only as `cause`, for the log.
 */
export function toAppError(error: unknown): AppError {
  rethrowFrameworkErrors(error);
  if (isAppError(error)) return error;
  return new InternalError(error instanceof Error ? error.message : String(error), error);
}

/** The message a user is allowed to see. */
export function publicMessage(error: AppError): string {
  return error.expose ? error.message : 'خطای غیرمنتظره رخ داد. لطفاً دوباره تلاش کنید.';
}
