import 'server-only';

/**
 * The system entry point — `@/features/posts/system`, cron only.
 *
 * `no-restricted-imports` allows this subpath from `src/app/api/cron/**` and
 * nowhere else. Everything here acts for the platform rather than a
 * signed-in user — no session to check, no user to scope to — so reaching it
 * from an ordinary route would be an unauthenticated write behind a normal
 * import. `…ForUser(userId, …)` functions (work done on behalf of a user by a
 * scheduler) belong here too.
 */
export { publishScheduledPosts } from './dal';
