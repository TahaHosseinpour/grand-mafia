import 'server-only';
import prisma from './db';
import { readSessionCookie, verifyUserToken } from './session';
import type { StaffRole } from '@/lib/prisma-enums';

/**
 * Who is on the other end of a socket.
 *
 * The Socket.IO counterpart of `@/server/auth`. Resolved **once**, at
 * handshake, from the session cookie the browser sends
 * with the upgrade request — the same cookie pages and actions read. Every
 * event handler gets this object from `socket.data`; nothing in an event
 * payload can change who the caller is.
 *
 * An anonymous socket (an observer at `/observe`) has `actor === null`.
 */
export type Actor = {
  userId: number;
  username: string;
  staffRole: StaffRole | null;
  verified: boolean;
};

export async function resolveActor(cookieHeader: string | undefined): Promise<Actor | null> {
  const token = readSessionCookie(cookieHeader);
  if (!token) return null;

  const decoded = verifyUserToken(token);
  if (!decoded) return null;

  // Confirms the row still exists and is not banned, as `getSession` does.
  const user = await prisma.user.findUnique({
    where: { id: decoded.userId },
    select: { id: true, username: true, staffRole: true, verified: true, isBanned: true },
  });
  if (!user || user.isBanned) return null;

  return { userId: user.id, username: user.username, staffRole: user.staffRole, verified: user.verified };
}
