import 'server-only';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@/generated/prisma/client';

/**
 * The application's single PrismaClient instance.
 *
 * Imported only by `src/server/*` and feature `dal.ts` files — ESLint bans it
 * everywhere else.
 *
 * Prisma 7 talks to Postgres through a driver adapter (`pg`). One instance per
 * process: the Next request handlers and the Socket.IO game layer run in the
 * same process (server.ts) but Next bundles its own copy of this module, so
 * there are two pools in total — sized by `pg`'s default (10) each.
 *
 * In development the instance is parked on `globalThis`: hot reload
 * re-evaluates the module, and without this every save opens a fresh pool
 * until Postgres refuses connections.
 *
 * `@/server/env` is deliberately not imported: every dal imports this module,
 * and depending on env would make each of them trigger full environment
 * validation. A missing DATABASE_URL fails clearly at the first query.
 */
const globalForPrisma = globalThis as unknown as { prisma: PrismaClient | undefined };

function createClient(): PrismaClient {
  const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
  return new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
  });
}

export const prisma = globalForPrisma.prisma ?? createClient();

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}

export default prisma;
