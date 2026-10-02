/**
 * Preloaded with `--import` by the custom server, seed and scripts.
 *
 * `server-only` throws when it is imported without the `react-server` export
 * condition. Next applies that condition inside its own server bundles, but
 * the custom server (server.ts) and the Socket.IO game layer run as plain
 * Node, and they legitimately import server-only modules (the Prisma client,
 * the logger). In this process — which never bundles anything for a browser —
 * the guard is meaningless, so it resolves to an empty module here. The guard
 * still does its job where it matters: in `next build`, against client
 * components.
 */
import { registerHooks } from 'node:module';

const EMPTY = 'data:text/javascript,export {};';

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier === 'server-only') return { url: EMPTY, format: 'module', shortCircuit: true };
    return nextResolve(specifier, context);
  },
});
