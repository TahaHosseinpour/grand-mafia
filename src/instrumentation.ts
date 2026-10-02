/**
 * Next's instrumentation hook. `onRequestError` catches every server error
 * that escaped a try/catch — the last safety net — and writes it to pino.
 *
 * The logger is imported dynamically and only under Node: pino is a Node
 * library and `@/server/logger` is `server-only`, so a static import would be
 * dragged into the edge bundle.
 */
export const onRequestError = async (
  error: { digest: string } & Error,
  request: { method: string; path: string; headers: { [key: string]: string } },
  context: {
    routerKind: string;
    routePath: string;
    routeType: string;
    renderSource: string;
    revalidateReason: string | undefined;
    serverComponentType: string;
  }
) => {
  if (process.env.NEXT_RUNTIME !== 'nodejs') return;

  try {
    const { log } = await import('@/server/logger');
    log().error(
      {
        err: error,
        digest: error.digest,
        method: request.method,
        path: request.path,
        routePath: context.routePath,
        routeType: context.routeType,
        renderSource: context.renderSource,
      },
      'unhandled request error'
    );
  } catch {
    // Never let the logger take down the error reporter.
  }
};
