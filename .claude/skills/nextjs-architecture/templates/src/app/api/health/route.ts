import { NextResponse, connection } from 'next/server';
import { defineRoute } from '@/server/http';
import { checkHealth } from '@/server/health';
import type { ErrorCode } from '@/server/errors';

/**
 * Health check for uptime monitors and the deploy script: 200 when the
 * database answers and the environment is valid, 503 otherwise, with the
 * per-check result in `data` either way.
 *
 * No rate limit, on purpose: a 429 reads as "down" to a monitor and would
 * make a deploy roll back a healthy release. The work is one `SELECT 1`.
 */
export const GET = defineRoute({
  handler: async () => {
    // Never prerendered or cached: the answer is only true at request time.
    await connection();

    const report = await checkHealth();
    const headers = { 'Cache-Control': 'no-store' };

    if (report.status === 'ok') {
      return NextResponse.json({ success: true, data: report }, { headers });
    }

    const code: ErrorCode = 'UNAVAILABLE';
    return NextResponse.json(
      { success: false, error: 'سرویس در حال حاضر در دسترس نیست', code, data: report },
      { status: 503, headers }
    );
  },
});
