import 'server-only';
import { z } from '@/lib/validation';
import { runWithContext, enrichContext } from './log-context';
import { log } from './logger';
import { toAppError, publicMessage, ValidationError } from './errors';
import { fieldErrors } from './http';
import { enforceRateLimit } from './rate-limit';
import type { RateLimitName } from './rate-limits';
import { requireAuth, requireStaff } from './auth';
import type { Session } from './auth';
import type { ActionResult } from './types';

/**
 * The Server Action factory. Every export of a feature's `actions.ts` is
 * built with it.
 *
 * Staff actions pass `auth: { staff: <minPower> }`; the dal re-checks staff
 * power itself (the factory option is only a fast filter).
 *
 * An action **never throws to its caller**. A thrown error crossing the
 * Server Action boundary reaches the client as an opaque digest with no
 * message, so it is caught, logged once, and returned as data:
 * `{ ok: true, data }` / `{ ok: false, error, code, details? }`.
 */

interface BaseOptions {
  /** `'<feature>.<verbThing>'` — for logs and grouping, not user-visible. */
  name: string;
  rateLimit?: RateLimitName;
}

function parseInput<TSchema extends z.ZodTypeAny>(schema: TSchema | undefined, raw: unknown): z.output<TSchema> {
  if (!schema) return raw as z.output<TSchema>;
  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    throw new ValidationError(
      parsed.error.issues[0]?.message ?? 'اطلاعات ارسالی معتبر نیست',
      fieldErrors(parsed.error)
    );
  }
  return parsed.data;
}

function failure(error: unknown, name: string): ActionResult<never> {
  // Rethrows redirect()/notFound() so they still navigate.
  const appError = toAppError(error);

  if (appError.status >= 500) {
    log().error({ err: appError, action: name, code: appError.code }, 'action failed');
  } else {
    log().warn({ action: name, code: appError.code, status: appError.status }, 'action rejected');
  }

  return {
    ok: false,
    error: publicMessage(appError),
    code: appError.code,
    ...(appError.details ? { details: appError.details } : {}),
  };
}

/* ------------------------------------------------------------------ *
 * User actions
 * ------------------------------------------------------------------ */

/**
 * The generic is the **schema**, not the parsed type. The returned function
 * accepts `z.input<TSchema>` (what a form holds — `'2'`, an ISO string) and
 * the handler receives `z.output<TSchema>` (what the dal needs — `2`, a
 * `Date`). Typing it as `z.ZodType<T>` would force callers to pass the
 * already-coerced value the schema exists to produce.
 */
interface ActionOptions<TSchema extends z.ZodTypeAny, TResult> extends BaseOptions {
  input?: TSchema;
  /**
   * `'none'` allows anonymous callers; the handler then gets `session: null`.
   * `{ staff: n }` requires a staff member with at least power `n`.
   */
  auth?: 'user' | 'none' | { staff: number };
  handler: (input: z.output<TSchema>, session: Session) => Promise<TResult>;
}

export function defineAction<TSchema extends z.ZodTypeAny = z.ZodVoid, TResult = unknown>(
  options: ActionOptions<TSchema, TResult>
) {
  return async (raw: z.input<TSchema>): Promise<ActionResult<TResult>> => {
    return runWithContext({ requestId: crypto.randomUUID(), route: options.name }, async () => {
      try {
        const input = parseInput(options.input, raw);

        let session = null as unknown as Session;
        const mode = options.auth ?? 'user';
        if (mode === 'user') {
          session = await requireAuth();
          enrichContext({ userId: session.userId });
        } else if (typeof mode === 'object') {
          session = await requireStaff(mode.staff);
          enrichContext({ userId: session.userId });
        }

        if (options.rateLimit) {
          const subject = session?.userId != null ? String(session.userId) : undefined;
          await (enforceRateLimit as (n: RateLimitName, s?: string) => Promise<void>)(
            options.rateLimit,
            subject
          );
        }

        return { ok: true, data: await options.handler(input, session) };
      } catch (error) {
        return failure(error, options.name);
      }
    });
  };
}
