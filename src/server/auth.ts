import 'server-only';
import { cache } from 'react';
import { cookies } from 'next/headers';
import prisma from './db';
import { UnauthorizedError, ForbiddenError } from './errors';
import { EVENTS, logSecurityEvent } from './events';
import { SESSION_COOKIE, verifyUserToken } from './session';
import { staffPower } from './staff';
import type { StaffRole } from '@/lib/prisma-enums';

/**
 * The authorization boundary for pages, routes and Server Actions.
 *
 * 1. These **throw** instead of returning `{ success: false }`. An envelope
 *    has to be checked at every call site; a forgotten check is a silent
 *    authorization bypass no type error catches.
 * 2. Session reads are wrapped in React `cache()`, so repeating a guard in
 *    the factory *and* in the dal within one request costs one lookup.
 *
 * The Socket.IO layer has its own entry (`./socket-auth.ts`): it verifies
 * the same cookie once at handshake and hands the dal an `Actor` it derived
 * from the verified token — never from an event payload.
 *
 * Staff (moderators, editors, admins) are users with a `staffRole`; there is
 * no separate admin table in this project (see AGENTS.md).
 */

export interface Session {
  userId: number;
  username: string;
  staffRole: StaffRole | null;
}

/**
 * The current user, or null.
 *
 * Confirms the row still exists and is not banned: a token stays
 * cryptographically valid after the account is deleted or banned.
 */
export const getSession = cache(async (): Promise<Session | null> => {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;

  const decoded = verifyUserToken(token);
  if (!decoded) return null;

  const user = await prisma.user.findUnique({
    where: { id: decoded.userId },
    select: { id: true, username: true, staffRole: true, isBanned: true },
  });
  if (!user || user.isBanned) return null;

  return { userId: user.id, username: user.username, staffRole: user.staffRole };
});

/** The current user, or throw 401. */
export async function requireAuth(): Promise<Session> {
  const session = await getSession();
  if (!session) throw new UnauthorizedError();
  return session;
}

/** `const userId = await requireUserId()` — the opening line of most user dal writes. */
export async function requireUserId(): Promise<number> {
  return (await requireAuth()).userId;
}

/**
 * A staff member with at least `minPower` (see `STAFF_POWER`): 1 moderator,
 * 2 editor, 3 admin. Read from the database on every call.
 */
export async function requireStaff(minPower: number): Promise<Session> {
  const session = await requireAuth();
  if (staffPower(session.staffRole) < minPower) {
    logSecurityEvent(EVENTS.SECURITY_FORBIDDEN, { userId: session.userId, reason: 'staff_power', minPower });
    throw new ForbiddenError();
  }
  return session;
}
