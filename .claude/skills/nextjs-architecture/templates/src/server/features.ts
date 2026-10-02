/**
 * The frozen list of feature domains. Each gets `src/features/<name>/`.
 *
 * Why freeze it: without a fixed list, someone invents `features/registrations`
 * overlapping two existing domains and the boundaries stop meaning anything.
 * A new domain is a change to this array, agreed first — not a new folder.
 * `FeatureName` derives from it, so a directory not on the list has no valid
 * name.
 */
export const FEATURES = [
  'auth',
  'users',
  'admin',
  'posts',
  // 'payments', 'notifications', 'media', …
] as const;

export type FeatureName = (typeof FEATURES)[number];

/**
 * The dependency graph: which feature may import which, through its barrel.
 *
 * **Not enforced by tooling** — a barrel import is legal to ESLint. It stays
 * true only if the PR that adds an import edge adds it here too, with a
 * comment saying *why*. An undocumented edge is how cycles and "god features"
 * appear.
 *
 * Shape rules:
 * - `users` is a leaf (depends on nothing).
 * - Nothing depends on `admin` or `auth`. Other features reach the session
 *   through `@/server/auth`, never through `features/auth`.
 * - `admin` only composes: the dashboard asks each feature for its own numbers
 *   (`…ForDashboard`) and reads no other feature's tables.
 * - Polymorphic features (payments, certificates: "a payment for a course OR
 *   an event") work with ids and enums and never import the product features.
 * - Side effects that must never be skipped (notifications) are an edge from
 *   the writer to `notifications`, called inside the dal write.
 */
export const FEATURE_LAYERS: Record<FeatureName, readonly FeatureName[]> = {
  // Sign-in responses carry the user's profile summary.
  auth: ['users'],
  users: [],
  // Composes every feature's `…ForAdmin` / `…ForDashboard` reads.
  admin: ['users', 'posts'],
  // A leaf. Comments carry `userId` as a plain id; the author's display name
  // would be an edge to `users`, added here with that reason when needed.
  posts: [],
};
