import 'server-only';
import prisma from './db';
import { getEnv } from './env';
import { log } from './logger';

/**
 * Liveness and readiness of this process, for `GET /api/health`.
 *
 * Two checks — things the whole app needs before it can serve one page: the
 * database answers, and the environment passes `env.ts`. The second matters
 * because env validation is lazy: a deploy missing a secret starts fine and
 * fails on the first request that reads it.
 *
 * The endpoint is public, so the report says only `ok`/`fail` per check. Why
 * a check failed (driver error, missing variable names) goes to the log only.
 *
 * Add a check only for a dependency without which *nothing* works. A flaky
 * third-party API is not one — failing health on it makes the deploy roll
 * back a healthy release.
 */

export type HealthCheckStatus = 'ok' | 'fail';

export type HealthReport = {
  status: HealthCheckStatus;
  checks: {
    database: HealthCheckStatus;
    environment: HealthCheckStatus;
  };
  /** Seconds since this process started — tells a deploy the restart happened. */
  uptimeSeconds: number;
  time: string;
};

/** Well under a deploy script's curl timeout, so a hung database is a clear 503. */
const DATABASE_TIMEOUT_MS = 3_000;

async function checkDatabase(): Promise<HealthCheckStatus> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    await Promise.race([
      prisma.$queryRaw`SELECT 1`,
      new Promise((_, reject) => {
        timer = setTimeout(
          () => reject(new Error(`database did not answer within ${DATABASE_TIMEOUT_MS}ms`)),
          DATABASE_TIMEOUT_MS
        );
      }),
    ]);
    return 'ok';
  } catch (error) {
    log().error({ err: error }, 'health: database check failed');
    return 'fail';
  } finally {
    clearTimeout(timer);
  }
}

function checkEnvironment(): HealthCheckStatus {
  try {
    getEnv();
    return 'ok';
  } catch (error) {
    log().error({ err: error }, 'health: environment is invalid');
    return 'fail';
  }
}

export async function checkHealth(): Promise<HealthReport> {
  const environment = checkEnvironment();
  const database = await checkDatabase();

  return {
    status: database === 'ok' && environment === 'ok' ? 'ok' : 'fail',
    checks: { database, environment },
    uptimeSeconds: Math.floor(process.uptime()),
    time: new Date().toISOString(),
  };
}
