import 'server-only';
import jwt, { type SignOptions } from 'jsonwebtoken';
import { cookies } from 'next/headers';
import { env } from './env';

/**
 * Session tokens and the cookie that carries them.
 *
 * Sessions are **started and ended only in `features/auth`** (through this
 * module) and **read only in `@/server/auth`** (pages, routes, actions) and
 * `./socket-auth.ts` (the Socket.IO handshake). Nothing else touches the
 * cookie.
 *
 * One cookie for everyone: moderators and admins are players with a staff
 * role, and they moderate from inside the game client — exactly as in the
 * legacy app. Staff power is checked against the database on every staff
 * operation, never read from the token.
 */

export const SESSION_COOKIE = 'auth-token';

/** Two weeks, the legacy session TTL. */
const SESSION_LIFETIME = '14d';
const SESSION_MAX_AGE_SECONDS = 14 * 24 * 60 * 60;

function cookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax' as const,
    path: '/',
    maxAge: SESSION_MAX_AGE_SECONDS,
  };
}

export type UserTokenPayload = { userId: number };

/**
 * A verified payload, or null. An expired or tampered token is a visitor, not
 * an error. The shape is checked, not cast.
 */
export function verifyUserToken(token: string): UserTokenPayload | null {
  try {
    const decoded = jwt.verify(token, env.JWT_SECRET);
    if (typeof decoded !== 'object' || typeof decoded.userId !== 'number') return null;
    return { userId: decoded.userId };
  } catch {
    return null;
  }
}

/**
 * The session token from a raw `Cookie` header — for the Socket.IO handshake,
 * which has no `cookies()` store.
 */
export function readSessionCookie(cookieHeader: string | undefined): string | null {
  if (!cookieHeader) return null;
  for (const part of cookieHeader.split(';')) {
    const [name, ...rest] = part.trim().split('=');
    if (name === SESSION_COOKIE) return decodeURIComponent(rest.join('='));
  }
  return null;
}

export async function startUserSession(userId: number): Promise<void> {
  const payload: UserTokenPayload = { userId };
  const token = jwt.sign(payload, env.JWT_SECRET, { expiresIn: SESSION_LIFETIME } as SignOptions);
  (await cookies()).set(SESSION_COOKIE, token, cookieOptions());
}

export async function endUserSession(): Promise<void> {
  (await cookies()).delete(SESSION_COOKIE);
}
