/**
 * The process entry point: one HTTP server hosting Next.js and Socket.IO.
 *
 * Why a custom server: the whole game is realtime (lobby, seats, votes,
 * chats) over Socket.IO, and its state lives in this process's memory, as in
 * the legacy app. Next's route handlers cannot hold WebSocket connections, so
 * Next runs inside this server instead of the other way round.
 *
 * Consequences, by design:
 * - Deploy on a Node host (VPS/Docker), not a serverless platform.
 * - Exactly **one** instance: live games are in memory. Restarting drops
 *   every game in progress, so deploy off-peak.
 *
 * Started with `--import ./scripts/register-hooks.mjs` (see that file).
 */
import { createServer } from 'node:http';
import next from 'next';
import { rootLogger } from '@/server/logger';

const dev = process.env.NODE_ENV !== 'production';
const port = Number(process.env.PORT ?? 3000);

async function main() {
  const app = next({ dev, port });
  const handle = app.getRequestHandler();
  await app.prepare();

  // Imported only after `prepare()`: the realtime layer shares modules with
  // the app (`next/headers`, `next/navigation` via `@/server/*`), and those
  // need the Node environment Next installs while preparing.
  const { attachRealtime } = await import('@/realtime/server');

  const server = createServer((req, res) => {
    void handle(req, res);
  });

  // Socket.IO owns `/socket.io/*` upgrades; every other upgrade (Next's dev
  // HMR socket) goes to Next.
  const io = attachRealtime(server);
  const upgradeNext = app.getUpgradeHandler();
  server.on('upgrade', (req, socket, head) => {
    if (!req.url?.startsWith('/socket.io/')) void upgradeNext(req, socket, head);
  });

  server.listen(port, () => {
    rootLogger.info({ port, dev }, `server ready on http://localhost:${port}`);
  });

  const shutdown = (signal: string) => {
    rootLogger.info({ signal }, 'shutting down');
    void io.close();
    server.close(() => process.exit(0));
    // Open sockets keep `close` waiting; do not hang a deploy on them.
    setTimeout(() => process.exit(0), 5_000).unref();
  };
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

main().catch((error: unknown) => {
  rootLogger.fatal({ err: error }, 'server failed to start');
  process.exit(1);
});
