import 'server-only';
import { PrismaClient } from '@prisma/client';

/**
 * The application's single PrismaClient instance.
 *
 * Imported only by `src/server/*` and feature `dal.ts` files — ESLint bans it
 * everywhere else.
 *
 * `import 'server-only'` turns an accidental client import into a build error
 * instead of a browser bundle that drags Prisma along.
 *
 * In development the instance is parked on `globalThis`: hot reload
 * re-evaluates the module, and without this every save opens a fresh
 * connection pool until Postgres refuses connections.
 *
 * `@/server/env` is deliberately not imported: every dal imports this module,
 * and depending on env would make each of them trigger full environment
 * validation. Prisma reads `DATABASE_URL` itself and fails clearly without it.
 */
const globalForPrisma = globalThis as unknown as { prisma: PrismaClient | undefined };

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
  });

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}

export default prisma;
