import type * as P from '@/generated/prisma/enums';

/**
 * Browser-safe copies of the Prisma enums that client-reachable code needs.
 *
 * A value import from the generated client in code that reaches a browser
 * bundle drags the model map along. ESLint bans value imports from
 * `@/generated/prisma/*` outside the data layer; import enums from here.
 *
 * Each object is checked against the generated type with `satisfies Mirror`:
 * a member added to or removed from the schema fails `tsc` here instead of
 * drifting.
 */

type Mirror<T extends string> = { readonly [K in T]: K };

export const StaffRole = {
  admin: 'admin',
  editor: 'editor',
  moderator: 'moderator',
  altmod: 'altmod',
  trialmod: 'trialmod',
  veteran: 'veteran',
  contributor: 'contributor',
} as const satisfies Mirror<P.StaffRole>;
export type StaffRole = P.StaffRole;

export const EmailTokenPurpose = {
  verify: 'verify',
  reset_password: 'reset_password',
} as const satisfies Mirror<P.EmailTokenPurpose>;
export type EmailTokenPurpose = P.EmailTokenPurpose;
