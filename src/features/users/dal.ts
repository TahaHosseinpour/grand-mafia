import 'server-only';
import prisma from '@/server/db';
import type { Prisma } from '@/generated/prisma/client';
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

/**
 * Elo of the given players at the moment a game starts, for the game's
 * record. Called by the engine with the names of the seated players.
 */
export async function getEloForGameStart(usernames: string[]): Promise<Record<string, { overall: number; season: number }>> {
  const users = await prisma.user.findMany({
    where: { usernameKey: { in: usernames.map((name) => name.toLowerCase()) } },
    select: { username: true, eloOverall: true, eloSeason: true },
  });
  return Object.fromEntries(users.map((user) => [user.username, { overall: user.eloOverall || 1600, season: user.eloSeason || 1600 }]));
}

/* ------------------------------------------------------------------ *
 * The realtime layer's view of a player
 *
 * These run for the Socket.IO engine, which resolves the caller once at
 * handshake (`src/server/socket-auth.ts`). The username comes from that
 * verified `Actor` or from a game's own seat list — never from an event
 * payload — so, like the `…ForAuth` functions, they carry no session check.
 * ------------------------------------------------------------------ */

import { CURRENT_SEASON_NUMBER } from '@/lib/game-constants';
import type { PresenceDTO } from './types';
import type { UserGameSettings } from './settings';

const asSettings = (value: unknown): UserGameSettings =>
  value && typeof value === 'object' && !Array.isArray(value) ? (value as UserGameSettings) : {};

export async function loadPresenceForRealtime(username: string): Promise<PresenceDTO | null> {
  const user = await prisma.user.findUnique({
    where: { usernameKey: usernameKey(username) },
    include: { seasonStats: { where: { season: CURRENT_SEASON_NUMBER } } },
  });
  if (!user) return null;
  const season = user.seasonStats[0];

  return {
    userId: user.id,
    username: user.username,
    staffRole: user.staffRole,
    isContributor: user.isContributor,
    isTournamentMod: user.isTournamentMod,
    verified: user.verified,
    isBanned: user.isBanned,
    timeoutUntil: user.timeoutUntil?.toISOString() ?? null,
    lastConnectedIp: user.lastConnectedIp ?? user.signupIp,
    touLastAgreed: user.touLastAgreed,
    hasNotDismissedSignupModal: user.hasNotDismissedSignupModal,
    lastVersionSeen: user.lastVersionSeen,
    bio: user.bio,
    gameSettings: asSettings(user.gameSettings),
    wins: user.wins,
    losses: user.losses,
    rainbowWins: user.rainbowWins,
    rainbowLosses: user.rainbowLosses,
    winsSeason: season?.wins ?? 0,
    lossesSeason: season?.losses ?? 0,
    rainbowWinsSeason: season?.rainbowWins ?? 0,
    rainbowLossesSeason: season?.rainbowLosses ?? 0,
    isRainbowOverall: user.isRainbowOverall,
    isRainbowSeason: user.isRainbowSeason,
    eloOverall: user.eloOverall,
    eloSeason: user.eloSeason,
    xpOverall: user.xpOverall,
    xpSeason: user.xpSeason,
  };
}

/** Saves a player's settings document (the engine has already merged and validated it). */
export async function saveGameSettingsForRealtime(username: string, settings: UserGameSettings): Promise<void> {
  await prisma.user.update({
    where: { usernameKey: usernameKey(username) },
    data: { gameSettings: settings as Prisma.InputJsonValue },
  });
}

export async function saveBioForRealtime(username: string, bio: string): Promise<void> {
  await prisma.user.update({ where: { usernameKey: usernameKey(username) }, data: { bio } });
}

export async function acceptTermsForRealtime(username: string, version: string): Promise<void> {
  await prisma.user.update({ where: { usernameKey: usernameKey(username) }, data: { touLastAgreed: version } });
}

export async function dismissSignupModalForRealtime(username: string): Promise<void> {
  await prisma.user.update({ where: { usernameKey: usernameKey(username) }, data: { hasNotDismissedSignupModal: false } });
}

export async function recordVersionSeenForRealtime(username: string, version: string): Promise<void> {
  await prisma.user.update({ where: { usernameKey: usernameKey(username) }, data: { lastVersionSeen: version } });
}

/** The first unacknowledged moderator warning of a player, if any. */
export async function findUnacknowledgedWarningForRealtime(username: string) {
  const warning = await prisma.warning.findFirst({
    where: { user: { usernameKey: usernameKey(username) }, acknowledged: false },
    orderBy: { id: 'asc' },
    select: { id: true, text: true, createdAt: true },
  });
  return warning ? { id: warning.id, text: warning.text, time: warning.createdAt.toISOString() } : null;
}

export async function acknowledgeWarningForRealtime(username: string): Promise<void> {
  const warning = await prisma.warning.findFirst({
    where: { user: { usernameKey: usernameKey(username) }, acknowledged: false },
    orderBy: { id: 'asc' },
    select: { id: true },
  });
  if (warning) await prisma.warning.update({ where: { id: warning.id }, data: { acknowledged: true } });
}

export async function submitFeedbackForRealtime(username: string, text: string): Promise<void> {
  const user = await prisma.user.findUnique({ where: { usernameKey: usernameKey(username) }, select: { id: true } });
  if (!user) throw new NotFoundError('حساب کاربری یافت نشد');
  await prisma.feedback.create({ data: { userId: user.id, text } });
}

/** When the player's second-most-recent feedback was sent: feedback is limited to two per day. */
export async function secondLastFeedbackAtForRealtime(username: string): Promise<Date | null> {
  const rows = await prisma.feedback.findMany({
    where: { user: { usernameKey: usernameKey(username) } },
    orderBy: { createdAt: 'desc' },
    take: 2,
    select: { createdAt: true },
  });
  return rows.length === 2 ? rows[1].createdAt : null;
}

/** Which of these players are staff (moderator tools may not be used to ping a moderator who plays). */
export async function findStaffAmongForRealtime(usernames: string[]): Promise<string[]> {
  const rows = await prisma.user.findMany({
    where: {
      usernameKey: { in: usernames.map((name) => name.toLowerCase()) },
      staffRole: { in: ['altmod', 'moderator', 'editor', 'admin', 'trialmod'] },
    },
    select: { username: true },
  });
  return rows.map((row) => row.username);
}
