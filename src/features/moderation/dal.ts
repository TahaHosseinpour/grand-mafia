import 'server-only';
import prisma from '@/server/db';
import { log } from '@/server/logger';
import { doesIPMatchCIDR, obfIP, withDefaultIPv6Range } from './ip';
import type { IpBanStatus } from './types';

/**
 * How long each kind of IP ban lasts (legacy routes/socket/models.js).
 * `permanent` rows never expire.
 */
const BAN_LENGTH_MS = {
  small: 18 * 60 * 60 * 1000,
  new: 18 * 60 * 60 * 1000,
  tiny: 1 * 60 * 60 * 1000,
  big: 7 * 24 * 60 * 60 * 1000,
} as const;

const banLength = (type: string) => BAN_LENGTH_MS[type as keyof typeof BAN_LENGTH_MS] ?? BAN_LENGTH_MS.big;

/**
 * Global switches moderators flip from the panel (legacy in-memory flags in
 * routes/socket/models.js; persisted here so a restart keeps them).
 */
export const GLOBAL_SWITCHES = {
  ipbansNotEnforced: 'ipbans-not-enforced',
  accountCreationDisabled: 'account-creation-disabled',
  gameCreationDisabled: 'game-creation-disabled',
  limitNewPlayers: 'limit-new-players',
} as const;
export type GlobalSwitch = keyof typeof GLOBAL_SWITCHES;

/** Is a global switch on? Missing = off. */
export async function isSwitchOn(name: GlobalSwitch): Promise<boolean> {
  const row = await prisma.globalSetting.findUnique({ where: { key: GLOBAL_SWITCHES[name] } });
  return row?.value === true;
}

/**
 * The active IP ban covering `ip`, or null. Mirrors legacy `testIP`:
 * a permanent ban wins; otherwise the most recent ban, if not yet expired.
 * Outside production bans are ignored (logged), as before, unless
 * IPBANS_IN_DEV is set.
 *
 * No identity: called before a session exists (sign-up, sign-in) and by the
 * socket handshake. It reads moderation data and reveals only the outcome.
 */
export async function getIpBanStatus(ip: string): Promise<IpBanStatus | null> {
  if (await isSwitchOn('ipbansNotEnforced')) return null;

  // Ranges (CIDR) cannot be matched in SQL portably; the table is small.
  const all = await prisma.bannedIp.findMany({ select: { ip: true, type: true, permanent: true, bannedDate: true } });
  const matches = all.filter((row) => row.ip === ip || doesIPMatchCIDR(row.ip, ip));
  if (!matches.length) return null;

  const permanent = matches.find((row) => row.permanent);
  if (permanent) return { type: permanent.type, until: null, permanent: true };

  const latest = matches.sort((a, b) => b.bannedDate.getTime() - a.bannedDate.getTime())[0];
  const until = latest.bannedDate.getTime() + banLength(latest.type);
  if (until <= Date.now()) return null;

  if (process.env.NODE_ENV !== 'production' && !process.env.IPBANS_IN_DEV) {
    log().debug({ type: latest.type }, 'IP ban ignored outside production');
    return null;
  }

  return { type: latest.type, until: new Date(until).toISOString(), permanent: false };
}

/**
 * Appends to the signups log moderators review (account creations, failed
 * sign-ups and sign-ins). Called from inside the auth dal writes.
 */
export async function recordSignupEvent(event: {
  userName: string;
  type: string;
  ip: string;
  /** Whether the sign-up gave an email; the address itself is not logged here. */
  hadEmail?: boolean;
}): Promise<void> {
  await prisma.signup.create({
    data: {
      userName: event.userName.slice(0, 16),
      type: event.type.slice(0, 32),
      ip: obfIP(event.ip),
      unobfuscatedIp: event.ip,
      email: event.hadEmail === undefined ? null : String(event.hadEmail),
    },
  });
}

/**
 * After an account is created, its address may not create another for 18
 * hours (legacy "new" IP ban; IPv6 bans the /64).
 */
export async function recordNewAccountIpBan(ip: string): Promise<void> {
  await prisma.bannedIp.create({ data: { ip: withDefaultIPv6Range(ip), type: 'new', permanent: false } });
}

/** Usernames ending in 88 are refused and counted (legacy EightEightCounter). */
export async function recordEightEight(username: string): Promise<void> {
  await prisma.eightEightCounter.create({ data: { username: username.slice(0, 16) } });
}
