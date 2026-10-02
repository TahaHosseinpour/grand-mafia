import 'server-only';
import jwt, { type SignOptions } from 'jsonwebtoken';
import { cookies } from 'next/headers';
import { env } from './env';

/**
 * Session tokens and the cookies that carry them.
 *
 * Sessions are **started and ended only in `features/auth`** (through this
 * module) and **read only in `@/server/auth`**. Nothing else touches the
 * cookies.
 *
 * Swap this file if the project uses another session mechanism (database
 * sessions, Auth.js…); `@/server/auth` keeps the same `getSession` /
 * `require*` surface and nothing in `features/` changes.
 */

export const AUTH_COOKIES = {
  USER: 'auth-token',
  ADMIN: 'admin_token',
} as const;

const SESSION_LIFETIME = '7d';
const SESSION_MAX_AGE_SECONDS = 7 * 24 * 60 * 60;

function cookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax' as const,
    path: '/',
    maxAge: SESSION_MAX_AGE_SECONDS,
  };
}

/**
 * The signing secret for a token audience. There is deliberately no hardcoded
 * fallback: a default secret means a misconfigured deploy accepts tokens
 * anyone can forge. `env` throws when `JWT_SECRET` is missing.
 */
function secretFor(audience: 'user' | 'admin'): string {
  return (audience === 'admin' ? env.ADMIN_JWT_SECRET : undefined) ?? env.JWT_SECRET;
}

/** A verified payload, or null. An expired or tampered token is a visitor, not an error. */
function verify(token: string, audience: 'user' | 'admin'): jwt.JwtPayload | null {
  try {
    const decoded = jwt.verify(token, secretFor(audience));
    return typeof decoded === 'object' ? decoded : null;
  } catch {
    return null;
  }
}

export type UserTokenPayload = { userId: number };
export type AdminTokenPayload = { adminId: number; role: string };

/**
 * The shape is checked, not cast: with one secret for both audiences a token
 * of one kind verifies as the other, and the id field tells them apart.
 */
export function verifyUserToken(token: string): UserTokenPayload | null {
  const decoded = verify(token, 'user');
  return typeof decoded?.userId === 'number' ? { userId: decoded.userId } : null;
}

export function verifyAdminToken(token: string): AdminTokenPayload | null {
  const decoded = verify(token, 'admin');
  if (typeof decoded?.adminId !== 'number') return null;
  return { adminId: decoded.adminId, role: String(decoded.role) };
}

export async function startUserSession(userId: number): Promise<void> {
  const payload: UserTokenPayload = { userId };
  const token = jwt.sign(payload, secretFor('user'), { expiresIn: SESSION_LIFETIME } as SignOptions);
  (await cookies()).set(AUTH_COOKIES.USER, token, cookieOptions());
}

export async function endUserSession(): Promise<void> {
  (await cookies()).delete(AUTH_COOKIES.USER);
}

export async function startAdminSession(payload: AdminTokenPayload): Promise<void> {
  const token = jwt.sign(payload, secretFor('admin'), { expiresIn: SESSION_LIFETIME } as SignOptions);
  (await cookies()).set(AUTH_COOKIES.ADMIN, token, cookieOptions());
}

export async function endAdminSession(): Promise<void> {
  (await cookies()).delete(AUTH_COOKIES.ADMIN);
}
