import 'server-only';
import { z } from '@/lib/validation';
import { runWithContext, enrichContext } from './log-context';
import { log } from './logger';
import { toAppError, publicMessage, ValidationError } from './errors';
import { fieldErrors } from './http';
import { enforceRateLimit } from './rate-limit';
import type { RateLimitName } from './rate-limits';
import { requireAuth, requireAdmin, requireAdminPermission, requireSuperAdmin } from './auth';
import type { Session, AdminSession } from './auth';
import type { ActionResult } from './types';
import type { AdminPagePath } from '@/lib/admin-pages';

/**
 * Server Action factories. Every export of a feature's `actions.ts` is built
 * with one of these.
 *
 * Two factories, because an admin is not a user: separate cookie, table and
 * RBAC. One factory with an optional `page` would make the admin check
 * something you can forget to pass.
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
  /** `'none'` allows anonymous callers; the handler then gets `session: null`. */
  auth?: 'user' | 'none';
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
        if ((options.auth ?? 'user') === 'user') {
          session = await requireAuth();
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

/* ------------------------------------------------------------------ *
 * Admin actions
 * ------------------------------------------------------------------ */

interface AdminActionOptions<TSchema extends z.ZodTypeAny, TResult> extends BaseOptions {
  input?: TSchema;
  /** The admin page this action belongs to. Omit only with `superAdmin`. */
  page?: AdminPagePath;
  /**
   * Defaults to `'full'`: an action mutates by definition, and a `'read'`
   * default would silently let a read-only admin write. List/read actions
   * say `access: 'read'` explicitly.
   */
  access?: 'read' | 'full';
  /** Role-gated: the privilege-escalation surface (admins, roles, permissions). */
  superAdmin?: boolean;
  handler: (input: z.output<TSchema>, admin: AdminSession) => Promise<TResult>;
}

export function defineAdminAction<TSchema extends z.ZodTypeAny = z.ZodVoid, TResult = unknown>(
  options: AdminActionOptions<TSchema, TResult>
) {
  return async (raw: z.input<TSchema>): Promise<ActionResult<TResult>> => {
    return runWithContext({ requestId: crypto.randomUUID(), route: options.name }, async () => {
      try {
        const input = parseInput(options.input, raw);

        let admin: AdminSession;
        if (options.superAdmin) {
          admin = await requireSuperAdmin();
        } else if (options.page) {
          admin = await requireAdminPermission(options.page, options.access ?? 'full');
        } else {
          admin = await requireAdmin();
        }
        enrichContext({ adminId: admin.adminId });

        if (options.rateLimit) {
          await (enforceRateLimit as (n: RateLimitName, s?: string) => Promise<void>)(
            options.rateLimit,
            String(admin.adminId)
          );
        }

        return { ok: true, data: await options.handler(input, admin) };
      } catch (error) {
        return failure(error, options.name);
      }
    });
  };
}
