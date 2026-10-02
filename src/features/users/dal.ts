import 'server-only';
import prisma from '@/server/db';
import { requireUserId } from '@/server/auth';
import { NotFoundError } from '@/server/errors';
import type { AccountDTO, CredentialsForAuth } from './types';

/**
 * The `users` data layer.
 *
 * Functions suffixed `ForAuth` are the account half of the auth flow. They
 * run before a session exists (sign-up, sign-in, password reset by token),
 * so they carry no identity check of their own: `features/auth` is their
 * only caller and does the checking (rate limits, password/token
 * verification). They are exported from the server barrel only.
 */

/** Lowercased username: the case-insensitive uniqueness key. */
export const usernameKey = (username: string) => username.toLowerCase();

const credentialsSelect = {
  id: true,
  username: true,
  passwordHash: true,
  email: true,
  verified: true,
  isBanned: true,
  timeoutUntil: true,
  staffRole: true,
  gameSettings: true,
} as const;

type CredentialsRow = {
  id: number;
  username: string;
  passwordHash: string;
  email: string | null;
  verified: boolean;
  isBanned: boolean;
  timeoutUntil: Date | null;
  staffRole: CredentialsForAuth['staffRole'];
  gameSettings: unknown;
};

function toCredentials(row: CredentialsRow): CredentialsForAuth {
  const settings = (row.gameSettings ?? {}) as { ignoreIPBans?: boolean };
  return {
    id: row.id,
    username: row.username,
    passwordHash: row.passwordHash,
    email: row.email,
    verified: row.verified,
    isBanned: row.isBanned,
    timeoutUntil: row.timeoutUntil?.toISOString() ?? null,
    staffRole: row.staffRole,
    ignoreIpBans: settings.ignoreIPBans === true,
  };
}

export async function findCredentialsByUsernameForAuth(username: string): Promise<CredentialsForAuth | null> {
  const row = await prisma.user.findUnique({ where: { usernameKey: usernameKey(username) }, select: credentialsSelect });
  return row ? toCredentials(row) : null;
}

export async function findCredentialsByIdForAuth(userId: number): Promise<CredentialsForAuth | null> {
  const row = await prisma.user.findUnique({ where: { id: userId }, select: credentialsSelect });
  return row ? toCredentials(row) : null;
}

/** The account a verified email belongs to (password reset). */
export async function findCredentialsByVerifiedEmailForAuth(email: string): Promise<CredentialsForAuth | null> {
  const row = await prisma.user.findFirst({
    where: { email: { equals: email, mode: 'insensitive' }, verified: true },
    select: credentialsSelect,
  });
  return row ? toCredentials(row) : null;
}

/** Which of username / email is already used (email only among verified accounts, as before). */
export async function findSignupConflictForAuth(
  username: string,
  email: string | undefined
): Promise<'username' | 'email' | null> {
  const byName = await prisma.user.findUnique({ where: { usernameKey: usernameKey(username) }, select: { id: true } });
  if (byName) return 'username';
  if (email) {
    const byEmail = await prisma.user.findFirst({
      where: { email: { equals: email, mode: 'insensitive' }, verified: true },
      select: { id: true },
    });
    if (byEmail) return 'email';
  }
  return null;
}

/** Is `email` the verified address of an account other than `exceptUserId`? */
export async function isEmailTakenForAuth(email: string, exceptUserId: number): Promise<boolean> {
  const other = await prisma.user.findFirst({
    where: { email: { equals: email, mode: 'insensitive' }, verified: true, id: { not: exceptUserId } },
    select: { id: true },
  });
  return Boolean(other);
}

export async function createUserForAuth(data: {
  username: string;
  passwordHash: string;
  email: string | null;
  isPrivate: boolean;
  signupIp: string;
}): Promise<{ id: number; username: string }> {
  return prisma.user.create({
    data: {
      username: data.username,
      usernameKey: usernameKey(data.username),
      passwordHash: data.passwordHash,
      email: data.email,
      verified: false,
      // New-account defaults (legacy routes/accounts.js).
      gameSettings: { soundStatus: 'pack2', disableSeasonal: true, isPrivate: data.isPrivate },
      signupIp: data.signupIp,
      lastConnectedIp: data.signupIp,
      lastConnectedAt: new Date(),
      ipHistory: [{ date: new Date().toISOString(), ip: data.signupIp }],
      profile: { create: {} },
    },
    select: { id: true, username: true },
  });
}

/** Last address and the address history (appended only when it changed). */
export async function recordConnectionForAuth(userId: number, ip: string): Promise<void> {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { ipHistory: true } });
  if (!user) throw new NotFoundError('حساب کاربری یافت نشد');
  const history = Array.isArray(user.ipHistory) ? (user.ipHistory as { date: string; ip: string }[]) : [];
  const last = history.at(-1);
  await prisma.user.update({
    where: { id: userId },
    data: {
      lastConnectedIp: ip,
      lastConnectedAt: new Date(),
      ...(last?.ip === ip ? {} : { ipHistory: [...history, { date: new Date().toISOString(), ip }] }),
    },
  });
}

export async function updatePasswordHashForAuth(userId: number, passwordHash: string): Promise<void> {
  await prisma.user.update({ where: { id: userId }, data: { passwordHash } });
}

/** Sets the account email; a changed address is unverified until its link is used. */
export async function updateEmailForAuth(userId: number, email: string | null): Promise<void> {
  await prisma.user.update({ where: { id: userId }, data: { email, verified: false } });
}

/** Marks the account verified, but only if `email` is still its address. */
export async function markEmailVerifiedForAuth(userId: number, email: string): Promise<boolean> {
  const { count } = await prisma.user.updateMany({
    where: { id: userId, email: { equals: email, mode: 'insensitive' } },
    data: { verified: true },
  });
  return count > 0;
}

export async function deleteUserForAuth(userId: number): Promise<void> {
  await prisma.user.delete({ where: { id: userId } });
}

/** The signed-in user's own account. */
export async function getMyAccount(): Promise<AccountDTO> {
  const userId = await requireUserId();
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { username: true, email: true, verified: true, createdAt: true },
  });
  if (!user) throw new NotFoundError('حساب کاربری یافت نشد');
  return {
    username: user.username,
    email: user.email,
    verified: user.verified,
    createdAt: user.createdAt.toISOString(),
  };
}
