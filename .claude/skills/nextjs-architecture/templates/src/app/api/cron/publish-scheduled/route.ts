import { defineRoute } from '@/server/http';
import { publishScheduledPosts } from '@/features/posts/system';

export const maxDuration = 60;

/**
 * A cron route: `auth: 'cron'` checks `Authorization: Bearer $CRON_SECRET`.
 *
 * It imports the feature's `system` subpath, which ESLint permits only from
 * `src/app/api/cron/**`: system functions act for the platform, not for a
 * signed-in caller, and must not be one ordinary import away.
 */
export const GET = defineRoute({
  auth: 'cron',
  handler: () => publishScheduledPosts(),
});
