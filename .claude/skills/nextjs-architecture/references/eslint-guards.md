# ESLint guards — what lint enforces, and what only review can

`npm run lint` is where the architecture is enforced (principle 3). Next 16's
build does not run ESLint, so CI running lint is load-bearing. Working config:
`templates/eslint.config.mjs`.

## The guards

| Rule | Scope | Catches |
|---|---|---|
| `@/server/db` banned | all of `src/` except `src/server/**`, `features/*/dal.ts`, `features/*/dal/*.ts` | queries outside the data layer |
| `zod` banned | all of `src/` except `src/lib/validation.ts` | validation messages silently changing language |
| deep `@/features/*/*` banned (except `/client`) | all of `src/` | reaching past a feature's barrel |
| `@/features/*/system` allowed | `src/app/api/cron/**` only | system (identity-less) work reachable from ordinary code |
| `@/server/auth` banned | `src/app/api/**` | routes hand-rolling the try/catch `defineRoute` removes (a thrown 401 in a hand-written catch becomes a 500) |
| `@prisma/client` value imports banned (`allowTypeImports`) | all of `src/` except the data layer | Prisma's browser index (every model's field map) shipping in a public chunk |
| `cacheLife({...})` object banned | all of `src/` | a cache duration outside `next.config.ts` |
| literal/template tag in `cacheTag` / `revalidateTag` / `updateTag` (first arg) | all of `src/` | a hand-written tag that does not match the other side |
| `fetch('/api/…')` banned | `src/features/**` except `components/` | server code calling its own API |
| `no-console` error | all of `src/`, no exemptions | logs with no request id, level or redaction |

Optional, for a migration: a `LEGACY_FILES` list exempted from the db/zod
bans (files come off, never on), and a temporary console-debt list with the
same one-way rule.

## Two mechanical traps

1. **`no-restricted-imports` and `no-restricted-syntax` are single rule
   names.** A later config block that sets one *replaces* it for the files it
   matches. So each ban is a named constant (`NO_DEEP_FEATURE_IMPORT`,
   `BAN_DB`, `CACHE_SYNTAX_RULES`, `NO_SELF_FETCH_RULES`) spread into every
   block that sets the rule. Adding a block for a subset of files silently
   disables what earlier blocks set for them — in one codebase the
   deep-import ban once existed only inside `src/features/**`, which left
   every route free to import a cron-only `system` module.
2. **`files` patterns are globs.** `[id]` is a character class ("i or d") and
   matches nothing real; write `\\[id\\]` or `*`. This once silently exempted
   94 files from `no-console`. A guard that is green because it matches
   nothing is the failure mode.

`@typescript-eslint/no-restricted-imports` is a separate rule name from the
core one, which is why the Prisma ban can coexist with the import blocks.

## Prove a guard fires

After changing any guard: write a file that violates it, run lint, see the
error, delete the file. For an exemption list, also remove one entry and
confirm the rule fires on it.

## Rejected as lint rules — measured, not assumed

- **Parent-scoped writes.** A selector banning singular `update/delete`
  whose `where` names no `…Id` fired **89 times on correct code** (root-table
  writes, writes after a scoped `findFirst`). ESLint has no dataflow. A rule
  that fires on good code gets disabled, which is worse than no rule.
- **"Every dal write resolves identity".** A file-level check passes once any
  one function in the dal mentions an auth helper — it proves nothing about
  the function you are reading.
- **Client files importing the server barrel.** The import path is identical
  either way; what makes it wrong is the `'use client'` directive, which
  ESLint's module graph does not model. Only `next build` catches it.
- **`try/catch` around a cached call.** Whether the callee is `'use cache'`
  is a property of another module.
- **`fetch('/api/…')` in a server `page.tsx`.** ESLint selects by path and
  cannot see `'use client'`; client pages fetching thin routes are legitimate.

## The manual review list (put it in AGENTS.md)

1. Every dal function that writes opens with a `require*` call (or says why not).
2. Every child write is scoped to its parent (and owner).
3. `'use client'` files import `@/features/<name>/client`; types via
   `import type` on their own line.
4. No `try/catch` used as a fallback around a `'use cache'` call.
5. Every `'use cache'` has a tag from `cache-tags.ts` and an **existing**
   `cacheLife` profile name (`cacheLife` is typed `string`; a typo silently
   uses `default`).
6. Every mutation invalidates its tags in the dal, or the commit says why not.
7. No DTO has a `Date`; DTOs are `type` aliases in the `AssertSerializable` tuple.
8. Every form field maps to a real column.
9. A new cross-feature import edge is recorded in `FEATURE_LAYERS` with a reason.
10. Dal directories match `FEATURES`.

Items 3–5 are caught only by `next build`; run it for changes in those areas.

## Optional: architecture tests

If the project chooses to have a test runner, the same rules can be written
as structural tests (`tests/architecture.test.ts` scanning files: no console
in server code, no raw event names, no `log().error` in dal files) plus an
authorization test with two users. Lint-first is the default because it runs
in the editor and in CI with no extra tooling.
