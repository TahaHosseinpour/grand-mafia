import nextCoreWebVitals from 'eslint-config-next/core-web-vitals';
import nextTypeScript from 'eslint-config-next/typescript';

/**
 * ESLint 9 flat config — and the architecture guards.
 *
 * `npm run lint` is where the architecture is enforced: a rule written only in
 * a document is eventually broken. Next 16's build does not run ESLint, so CI
 * running `npm run lint` is load-bearing.
 *
 * TWO TRAPS before editing this file:
 *
 * 1. `no-restricted-imports` and `no-restricted-syntax` are single rule
 *    names. A later block that sets one for some files REPLACES it for those
 *    files rather than adding to it. That is why the bans are named constants
 *    spread into every block that sets the rule. A new guard must be spread
 *    into every block that should carry it.
 *
 * 2. `files` entries are globs, not paths. A dynamic segment like `[id]` is a
 *    character class ("one of i or d") and matches nothing real — write
 *    `\\[id\\]` or `*`. A guard that is green because it matches nothing is
 *    the failure mode to watch for.
 *
 * After changing any guard, prove it fires: write a file that violates it,
 * run lint, see the error, delete the file. For an exemption list, also
 * remove an entry and confirm the rule then fires on it.
 *
 * @type {import('eslint').Linter.Config[]}
 */

const SRC = ['src/**/*.ts', 'src/**/*.tsx', 'server.ts'];

/** The only files that may import the Prisma client. */
const DAL_FILES = ['src/server/**', 'src/features/*/dal.ts', 'src/features/*/dal/*.ts'];

/** Prisma's generated client (src/generated) — never imported for values outside the data layer. */
const GENERATED_PRISMA = ['@/generated/prisma/*', '@/generated/prisma/**'];

/**
 * Migration burndown: legacy files still allowed to query the database or
 * import `zod` directly while the project moves onto this architecture.
 * Files come OFF this list, never on. Empty in a new project.
 */
const LEGACY_FILES = [
  // 'src/app/old-page/page.tsx',
];

/**
 * A feature has two public entry points: `@/features/<name>` (server) and
 * `@/features/<name>/client` (components). Everything else is private;
 * `system` is cron-only and `realtime` is for the Socket.IO layer
 * (`src/realtime`, `server.ts`) — each re-permitted in its own block below.
 */
const NO_DEEP_FEATURE_IMPORT = {
  group: ['@/features/*/*', '!@/features/*/client'],
  message:
    'A feature has two public entry points: `@/features/<name>` for server code and `@/features/<name>/client` for components. Everything else inside it is private; `system` is cron-only and `realtime` is for the Socket.IO layer.',
};

const REALTIME_FEATURE_IMPORT = {
  group: ['@/features/*/*', '!@/features/*/client', '!@/features/*/realtime'],
  message: 'The Socket.IO layer may import a feature barrel or its `realtime` subpath, nothing else inside it.',
};

const CRON_FEATURE_IMPORT = {
  group: ['@/features/*/*', '!@/features/*/client', '!@/features/*/system'],
  message: 'Cron routes may import a feature barrel or its `system` subpath, nothing else inside it.',
};

const BAN_DB = {
  name: '@/server/db',
  message: 'Only a feature dal (and src/server) touches the database. Call the feature through `@/features/<name>`.',
};

const BAN_ZOD = {
  name: 'zod',
  message: "Import `z` from '@/lib/validation'. A direct zod import loses the project locale and messages silently turn English.",
};

const BAN_AUTH_IN_ROUTES = {
  name: '@/server/auth',
  message:
    'Routes get their session from `defineRoute({ auth })` in `@/server/http`. Importing the guards means hand-rolling the try/catch defineRoute exists to remove.',
};

/**
 * Cache guards. Durations live only in `next.config.ts`; tags only in
 * `@/server/cache-tags`. A hand-written tag that does not match the other
 * side fails as "the admin saved and the site did not change".
 */
const CACHE_SYNTAX_RULES = [
  {
    selector: "CallExpression[callee.name='cacheLife'] > ObjectExpression",
    message: 'cacheLife() takes a profile name, never an inline object. Add a profile in `next.config.ts` and name it here.',
  },
  {
    selector: "CallExpression[callee.name='cacheTag'] > Literal",
    message: 'Tag strings come from `tags` in `@/server/cache-tags`.',
  },
  {
    selector: "CallExpression[callee.name='cacheTag'] > TemplateLiteral",
    message: 'Tag strings come from `tags` in `@/server/cache-tags`.',
  },
  {
    // First argument only: `revalidateTag(tag, 'max')` has a legitimate string second.
    selector: "CallExpression[callee.name=/^(revalidateTag|updateTag)$/][arguments.0.type='Literal']",
    message: 'Tag strings come from `tags` in `@/server/cache-tags`.',
  },
  {
    selector: "CallExpression[callee.name=/^(revalidateTag|updateTag)$/][arguments.0.type='TemplateLiteral']",
    message: 'Tag strings come from `tags` in `@/server/cache-tags`.',
  },
];

/**
 * Server code must not fetch its own API: a network round trip to reach a
 * function it could call, losing the request's auth context on the way.
 * Scoped to feature code (minus components): ESLint cannot see `'use client'`,
 * and a client page fetching a thin route is legitimate.
 */
const NO_SELF_FETCH_RULES = [
  {
    selector: "CallExpression[callee.name='fetch'] > Literal[value=/\\/api\\//]",
    message: 'Server code must not fetch its own API. Import the feature and call the dal.',
  },
  {
    selector: "CallExpression[callee.name='fetch'] > TemplateLiteral > TemplateElement[value.raw=/\\/api\\//]",
    message: 'Server code must not fetch its own API. Import the feature and call the dal.',
  },
];

const config = [
  {
    ignores: [
      'node_modules/**',
      '.next/**',
      'out/**',
      'build/**',
      'coverage/**',
      'public/**',
      'prisma/migrations/**',
      'next-env.d.ts',
      'src/generated/**',
      // The pre-rewrite Express app, kept as the porting reference until every
      // feature has moved; deleted at the end of the migration.
      'legacy/**',
      // Reference code for the architecture skill, not part of this app.
      '.claude/**',
    ],
  },

  ...nextCoreWebVitals,
  ...nextTypeScript,

  /* ---- Imports: which layer may reach which --------------------------- */

  // The floor: deep feature imports are banned everywhere.
  {
    files: SRC,
    rules: { 'no-restricted-imports': ['error', { patterns: [NO_DEEP_FEATURE_IMPORT] }] },
  },

  // Outside the data layer: no database, no raw zod.
  {
    files: SRC,
    ignores: [...DAL_FILES, ...LEGACY_FILES, 'src/lib/validation.ts'],
    rules: {
      'no-restricted-imports': ['error', { paths: [BAN_DB, BAN_ZOD], patterns: [NO_DEEP_FEATURE_IMPORT] }],
    },
  },

  // The data layer may use the database, still not raw zod.
  {
    files: DAL_FILES,
    rules: {
      'no-restricted-imports': ['error', { paths: [BAN_ZOD], patterns: [NO_DEEP_FEATURE_IMPORT] }],
    },
  },

  // The Socket.IO layer additionally gets `@/features/<name>/realtime` (the engine's entry points).
  {
    files: ['src/realtime/**/*.ts', 'server.ts'],
    ignores: [...LEGACY_FILES],
    rules: {
      'no-restricted-imports': ['error', { paths: [BAN_DB, BAN_ZOD], patterns: [REALTIME_FEATURE_IMPORT] }],
    },
  },

  // Routes reach auth only through defineRoute.
  {
    files: ['src/app/api/**/*.ts'],
    ignores: LEGACY_FILES,
    rules: {
      'no-restricted-imports': [
        'error',
        { paths: [BAN_DB, BAN_ZOD, BAN_AUTH_IN_ROUTES], patterns: [NO_DEEP_FEATURE_IMPORT] },
      ],
    },
  },

  // Cron routes additionally get `@/features/<name>/system`.
  {
    files: ['src/app/api/cron/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        { paths: [BAN_DB, BAN_ZOD, BAN_AUTH_IN_ROUTES], patterns: [CRON_FEATURE_IMPORT] },
      ],
    },
  },

  /**
   * No runtime value from the generated Prisma client outside the data layer.
   * A value import in anything that reaches a client bundle ships the model
   * map — every field name — in a public chunk. Enums come from
   * `@/lib/prisma-enums`; `import type` stays allowed. (The typescript-eslint
   * rule is a separate rule name, so it does not collide with the blocks above.)
   */
  {
    files: SRC,
    ignores: [...DAL_FILES, 'src/lib/prisma-enums.ts'],
    rules: {
      '@typescript-eslint/no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: GENERATED_PRISMA,
              allowTypeImports: true,
              message: 'Import enums from `@/lib/prisma-enums` (or use `import type`). A value import ships the schema map to the browser.',
            },
          ],
        },
      ],
    },
  },

  /* ---- Syntax: cache guards and self-fetch ---------------------------- */

  { files: SRC, rules: { 'no-restricted-syntax': ['error', ...CACHE_SYNTAX_RULES] } },
  {
    files: ['src/features/**/*.ts', 'src/features/**/*.tsx'],
    rules: { 'no-restricted-syntax': ['error', ...CACHE_SYNTAX_RULES, ...NO_SELF_FETCH_RULES] },
  },
  {
    // Client components may fetch a thin route; the cache guards still apply.
    files: ['src/features/*/components/**'],
    rules: { 'no-restricted-syntax': ['error', ...CACHE_SYNTAX_RULES] },
  },

  /* ---- Logging -------------------------------------------------------- */

  // No exemptions. Server code: `log()` from `@/server/logger`. Client code:
  // no logging.
  { files: SRC, rules: { 'no-console': 'error' } },
];

export default config;
