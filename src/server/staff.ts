import type { StaffRole } from '@/lib/prisma-enums';

/**
 * Staff power levels — the numbers the legacy engine compared everywhere
 * (`getPowerFromRole`). Isomorphic: the client uses them to decide what to
 * draw; the server re-checks them against the database before acting.
 */
export const STAFF_POWER: Record<StaffRole, number> = {
  admin: 3,
  editor: 2,
  moderator: 1,
  // AEM report delays check for >= 0.
  altmod: 0,
  trialmod: 0,
  veteran: -1,
  contributor: -1,
};

export function staffPower(role: StaffRole | null | undefined): number {
  return role ? STAFF_POWER[role] : -1;
}

/** Moderator or above (altmod and trialmod included): the in-game "AEM". */
export function isAem(role: StaffRole | null | undefined): boolean {
  return role === 'admin' || role === 'editor' || role === 'moderator' || role === 'altmod' || role === 'trialmod';
}

/**
 * Moderator, editor or admin — the roles that count as "AEM" for chat
 * commands and moderator-only abilities in a game. Trial/alt moderators and
 * veterans have narrower powers.
 */
export function isFullStaff(role: StaffRole | '' | null | undefined): boolean {
  return role === 'admin' || role === 'editor' || role === 'moderator';
}

/** The staff label shown beside a chat message ("" for everyone else). */
export function chatStaffLabel(role: StaffRole | '' | null | undefined): 'moderator' | 'editor' | 'admin' | undefined {
  return isFullStaff(role) ? (role as 'moderator' | 'editor' | 'admin') : undefined;
}
