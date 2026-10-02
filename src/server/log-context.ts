import 'server-only';
import { AsyncLocalStorage } from 'node:async_hooks';

/**
 * Per-request context, without threading it through every signature.
 *
 * Otherwise a log line deep in a dal would need `requestId` passed down from
 * the route through every function — an infrastructure concern polluting
 * domain signatures. `AsyncLocalStorage` survives `await`, so the context is
 * set once in `defineRoute` / `defineAction` and visible everywhere below.
 */

export interface LogContext {
  /** `crypto.randomUUID()` at the request boundary. */
  requestId: string;
  /** The signed-in user, when there is one. */
  userId?: number;
  /** The Socket.IO connection, for lines from the realtime layer. */
  socketId?: string;
  /** Route path, action name or socket event, for grouping. */
  route?: string;
}

const storage = new AsyncLocalStorage<LogContext>();

export function runWithContext<T>(context: LogContext, fn: () => T): T {
  return storage.run(context, fn);
}

export function getContext(): LogContext | undefined {
  return storage.getStore();
}

/**
 * Adds to the current context.
 *
 * `userId` is only known after auth has run, i.e. after the context was
 * created; the object is mutated in place so later lines carry the id.
 */
export function enrichContext(patch: Partial<Omit<LogContext, 'requestId'>>): void {
  const current = storage.getStore();
  if (!current) return;
  Object.assign(current, patch);
}
