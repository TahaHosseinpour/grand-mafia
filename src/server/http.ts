import 'server-only';
import { timingSafeEqual } from 'node:crypto';
import { NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { z } from '@/lib/validation';
import { runWithContext, enrichContext } from './log-context';
import { log } from './logger';
import { env } from './env';
import { toAppError, publicMessage, ValidationError, UnauthorizedError, RateLimitError } from './errors';
import { enforceRateLimit } from './rate-limit';
import type { RateLimitName } from './rate-limits';
import { requireAuth, requireStaff, getSession } from './auth';
import type { Session } from './auth';

/**
 * The route handler factory. Every `src/app/api/**\/route.ts` is built with it.
 *
 * One preamble instead of one per route: request id + log context, param /
 * query / body validation, auth, rate limit, the try/catch, and the JSON
 * envelope. A route body is then one line over a dal function:
 *
 *     export const GET = defineRoute({
 *       query: listPostsQuery,
 *       handler: ({ query }) => listPosts(query),
 *     });
 *
 * Returns a `Response`, so binary downloads, redirects and XML can use it
 * too: a handler that returns a `Response` is passed straight through.
 *
 * Envelope: `{ success: true, data }` / `{ success: false, error, code, details? }`.
 */

type AuthMode =
  | 'none'
  | 'user'
  /** A staff member with at least this power (1 moderator, 2 editor, 3 admin). */
  | { staff: number }
  /** Cron and scheduled callers: `Authorization: Bearer $CRON_SECRET`, no cookie. */
  | 'cron';

interface RouteContext<TBody, TQuery, TParams> {
  request: Request;
  /** Awaited, and parsed when a `params` schema was given — `[id]` arrives as a number. */
  params: TParams;
  body: TBody;
  query: TQuery;
  /** Present when `auth` is 'user' or staff (and, if signed in, when 'none'). */
  session: Session;
}

interface RouteOptions<TBody, TQuery, TParams, TResult> {
  auth?: AuthMode;
  /** A named limit from `@/server/rate-limits`. */
  rateLimit?: RateLimitName;
  /** Subject for a `by: 'subject'` limit, derived from the parsed body. */
  rateLimitSubject?: (body: TBody) => string;
  input?: z.ZodType<TBody>;
  query?: z.ZodType<TQuery>;
  /** Dynamic segments — `zIdParams()`, `zSlugParams()`. Without it a junk id is a 500, not a 400. */
  params?: z.ZodType<TParams>;
  handler: (context: RouteContext<TBody, TQuery, TParams>) => Promise<TResult> | TResult;
}

function jsonError(
  message: string,
  code: string,
  status: number,
  details?: Record<string, string[]>,
  extraHeaders?: Record<string, string>
): NextResponse {
  return NextResponse.json(
    { success: false, error: message, code, ...(details ? { details } : {}) },
    { status, ...(extraHeaders ? { headers: extraHeaders } : {}) }
  );
}

async function parseJsonBody(request: Request): Promise<unknown> {
  const contentType = request.headers.get('content-type') ?? '';
  if (!contentType.includes('application/json')) return undefined;
  try {
    return await request.json();
  } catch {
    throw new ValidationError('ساختار درخواست معتبر نیست');
  }
}

export function fieldErrors(error: z.ZodError): Record<string, string[]> {
  const details: Record<string, string[]> = {};
  for (const issue of error.issues) {
    const key = issue.path.length ? issue.path.join('.') : '_';
    (details[key] ??= []).push(issue.message);
  }
  return details;
}

function parseOrThrow<T>(schema: z.ZodType<T>, raw: unknown): T {
  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    throw new ValidationError(
      parsed.error.issues[0]?.message ?? 'اطلاعات ارسالی معتبر نیست',
      fieldErrors(parsed.error)
    );
  }
  return parsed.data;
}

function isCronAuthorized(provided: string | null): boolean {
  const expected = `Bearer ${env.CRON_SECRET}`;
  if (!provided || provided.length !== expected.length) return false;
  return timingSafeEqual(Buffer.from(provided), Buffer.from(expected));
}

export function defineRoute<
  TBody = unknown,
  TQuery = unknown,
  TParams = Record<string, string>,
  TResult = unknown,
>(options: RouteOptions<TBody, TQuery, TParams, TResult>) {
  return async (
    request: Request,
    segmentData?: { params: Promise<Record<string, string>> }
  ): Promise<Response> => {
    const requestId = crypto.randomUUID();
    const url = new URL(request.url);

    return runWithContext({ requestId, route: url.pathname }, async () => {
      try {
        // --- input ---------------------------------------------------
        const rawParams = segmentData ? await segmentData.params : {};
        const params = options.params ? parseOrThrow(options.params, rawParams) : (rawParams as TParams);
        const body = options.input
          ? parseOrThrow(options.input, await parseJsonBody(request))
          : (undefined as TBody);
        const query = options.query
          ? parseOrThrow(options.query, Object.fromEntries(url.searchParams.entries()))
          : (undefined as TQuery);

        // --- auth ----------------------------------------------------
        // Before the rate limit, so a `by: 'user'` limit has an id to key on.
        const mode = options.auth ?? 'none';
        let session = undefined as unknown as Session;

        if (mode === 'user') {
          session = await requireAuth();
          enrichContext({ userId: session.userId });
        } else if (typeof mode === 'object') {
          session = await requireStaff(mode.staff);
          enrichContext({ userId: session.userId });
        } else if (mode === 'cron') {
          if (!isCronAuthorized((await headers()).get('authorization'))) {
            throw new UnauthorizedError('دسترسی غیرمجاز');
          }
        } else {
          // 'none' still resolves an optional session, so anonymous-allowed
          // endpoints can personalise without a second cookie read.
          const maybe = await getSession();
          if (maybe) {
            session = maybe;
            enrichContext({ userId: maybe.userId });
          }
        }

        // --- rate limit ----------------------------------------------
        if (options.rateLimit) {
          const subject = options.rateLimitSubject
            ? options.rateLimitSubject(body)
            : session?.userId != null
              ? String(session.userId)
              : undefined;
          // The overloads on enforceRateLimit are narrower than what is known
          // here; the name is still checked by `RateLimitName`.
          await (enforceRateLimit as (n: RateLimitName, s?: string) => Promise<void>)(
            options.rateLimit,
            subject
          );
        }

        // --- handler --------------------------------------------------
        const result = await options.handler({ request, params, body, query, session });
        if (result instanceof Response) return result;
        return NextResponse.json({ success: true, data: result });
      } catch (error) {
        // `toAppError` rethrows redirect()/notFound() before anything else.
        const appError = toAppError(error);

        // The one place a route failure is logged: bugs at `error`, expected
        // rejections at `warn`. The dal never logs errors itself.
        if (appError.status >= 500) {
          log().error({ err: appError, code: appError.code }, 'route failed');
        } else {
          log().warn({ code: appError.code, status: appError.status }, 'route rejected');
        }

        if (appError instanceof RateLimitError) {
          return jsonError(appError.message, appError.code, 429, undefined, {
            'Retry-After': String(appError.retryAfter),
            'X-RateLimit-Remaining': String(appError.remaining),
            'X-RateLimit-Reset': String(appError.resetTime),
          });
        }

        return jsonError(publicMessage(appError), appError.code, appError.status, appError.details);
      }
    });
  };
}
