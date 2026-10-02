import 'server-only';
import { createHash, randomBytes } from 'node:crypto';
import bcrypt from 'bcryptjs';
import prisma from '@/server/db';
import { requireUserId } from '@/server/auth';
import { getClientIp } from '@/server/client-ip';
import { appUrl, isProduction } from '@/server/env';
import { ConflictError, ForbiddenError, NotFoundError, UnauthorizedError, ValidationError } from '@/server/errors';
import { EVENTS, logEvent } from '@/server/events';
import { sendMail } from '@/server/mailer';
import { enforceRateLimit } from '@/server/rate-limit';
import { absoluteUrl, routes } from '@/server/routes';
import { endUserSession, startUserSession } from '@/server/session';
import { formatDateTime } from '@/lib/datetime';
import type { EmailTokenPurpose } from '@/lib/prisma-enums';
import {
  createUserForAuth,
  deleteUserForAuth,
  findCredentialsByIdForAuth,
  findCredentialsByUsernameForAuth,
  findCredentialsByVerifiedEmailForAuth,
  findSignupConflictForAuth,
  isEmailTakenForAuth,
  markEmailVerifiedForAuth,
  recordConnectionForAuth,
  updateEmailForAuth,
  updatePasswordHashForAuth,
} from '@/features/users';
import {
  expandAndSimplify,
  getIpBanStatus,
  isSwitchOn,
  recordEightEight,
  recordNewAccountIpBan,
  recordSignupEvent,
} from '@/features/moderation';
import { BLOCKED_USERNAME_WORDS } from './blocked-username-words';
import { verificationEmail, passwordResetEmail } from './emails';
import type { z } from '@/lib/validation';
import type {
  changeEmailInput,
  changePasswordInput,
  deleteAccountInput,
  requestPasswordResetInput,
  resetPasswordInput,
  signInInput,
  signUpInput,
  verifyEmailInput,
} from './inputs';

/**
 * Sign-up, sign-in, sign-out, email verification and password reset —
 * ported from legacy/routes/accounts.js and legacy/routes/verification.js.
 * Messages are the legacy ones, in Persian.
 */

const BCRYPT_ROUNDS = 12;
/** Email links last one day, as before. */
const TOKEN_LIFETIME_MS = 24 * 60 * 60 * 1000;

const CONTACT_MODS = 'اگر فکر می‌کنید اشتباهی رخ داده، با مدیران تماس بگیرید.';

/** A hash compared when the username does not exist, so both paths cost one bcrypt. */
const DUMMY_HASH = bcrypt.hashSync('not-a-real-password', BCRYPT_ROUNDS);

async function currentIp(): Promise<string> {
  return expandAndSimplify(await getClientIp());
}

/* ------------------------------------------------------------------ *
 * Sign-up
 * ------------------------------------------------------------------ */

let disposableDomains: Set<string> | null = null;
async function isDisposableEmail(email: string): Promise<boolean> {
  if (!disposableDomains) {
    const list = (await import('./disposable-email-domains.json')).default as string[];
    disposableDomains = new Set(list);
  }
  const domain = email.split('@')[1]?.toLowerCase();
  return Boolean(domain && disposableDomains.has(domain));
}

/** The IP-ban answer for sign-up, or null when the address may sign up. */
function signupBanMessage(type: string, until: string | null): string {
  if (type === 'tiny' && until) {
    return `آدرس IP شما موقتاً محدود شده است. ${CONTACT_MODS} محدودیت شما در ${formatDateTime(until)} تمام می‌شود.`;
  }
  if (type === 'new') {
    return 'از هر آدرس فقط یک بار در روز می‌توان حساب ساخت. اگر به استثنا نیاز دارید، با مدیران تماس بگیرید.';
  }
  return `شما دیگر به این سرویس دسترسی ندارید. ${CONTACT_MODS}`;
}

/** Public sign-up: there is no session yet, so no identity check applies. */
export async function signUp(input: z.output<typeof signUpInput>): Promise<{ username: string }> {
  const { username, password, email, isPrivate } = input;
  const ip = await currentIp();

  if (BLOCKED_USERNAME_WORDS.some((word) => username.toLowerCase().includes(word.toLowerCase()))) {
    throw new ValidationError('نام کاربری شما شامل کلمه‌ای نامناسب است.', { username: ['نام کاربری نامناسب است'] });
  }
  if (/88$/i.test(username)) {
    await recordEightEight(username);
    throw new ValidationError('نام‌های کاربری که با ۸۸ تمام می‌شوند مجاز نیستند.', {
      username: ['نام کاربری مجاز نیست'],
    });
  }
  if (email && isProduction() && (await isDisposableEmail(email))) {
    throw new ValidationError('فقط ایمیل‌های غیرموقت برای ساخت حساب تأییدشده پذیرفته می‌شوند.', {
      email: ['ایمیل موقت پذیرفته نمی‌شود'],
    });
  }

  const conflict = await findSignupConflictForAuth(username, email);
  if (conflict === 'username') {
    throw new ConflictError('این حساب کاربری از قبل وجود دارد.');
  }
  if (conflict === 'email') {
    throw new ConflictError('این ایمیل توسط حساب تأییدشده‌ی دیگری استفاده می‌شود؛ لطفاً ایمیل دیگری وارد کنید.');
  }

  if (await isSwitchOn('accountCreationDisabled')) {
    throw new ForbiddenError('ساخت حساب جدید موقتاً غیرفعال است. لطفاً بعداً تلاش کنید.');
  }

  const ban = await getIpBanStatus(ip);
  if (ban) {
    await recordSignupEvent({
      userName: username,
      type: `Failed - IPBanned ${ban.permanent ? 'permanent ' : ''}${ban.type}`,
      ip,
      hadEmail: Boolean(email),
    });
    throw new ForbiddenError(signupBanMessage(ban.type, ban.until));
  }

  const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);
  const user = await createUserForAuth({ username, passwordHash, email: email ?? null, isPrivate, signupIp: ip });

  await recordNewAccountIpBan(ip);
  await recordSignupEvent({ userName: username, type: isPrivate ? 'private' : 'local', ip, hadEmail: Boolean(email) });
  logEvent(EVENTS.AUTH_SIGNUP, { userId: user.id, isPrivate });

  if (email) await sendEmailToken(user.id, user.username, email, 'verify');

  await startUserSession(user.id);
  return { username: user.username };
}

/* ------------------------------------------------------------------ *
 * Sign-in / sign-out
 * ------------------------------------------------------------------ */

const WRONG_CREDENTIALS = 'رمز عبور برای این نام کاربری صحیح نیست.';

/** Public sign-in. Two rate-limit buckets: per IP (factory) and per account (here). */
export async function signIn(input: z.output<typeof signInInput>): Promise<{ username: string }> {
  await enforceRateLimit('LOGIN_ACCOUNT', input.username.toLowerCase());
  const ip = await currentIp();

  const ban = await getIpBanStatus(ip);
  if (ban && !['new', 'small', 'big', 'tiny'].includes(ban.type)) {
    throw new ForbiddenError(`شما دیگر به این سرویس دسترسی ندارید. ${CONTACT_MODS}`);
  }

  const user = await findCredentialsByUsernameForAuth(input.username);
  const passwordOk = await bcrypt.compare(input.password, user?.passwordHash ?? DUMMY_HASH);
  if (!user || !passwordOk) {
    logEvent(EVENTS.AUTH_LOGIN_FAILED, { reason: user ? 'password' : 'unknown_user' });
    throw new UnauthorizedError(WRONG_CREDENTIALS);
  }

  if (ban && ban.type !== 'new') {
    await recordSignupEvent({
      userName: user.username,
      type: `Failed Login - IPBanned ${ban.permanent ? 'permanent ' : ''}${ban.type}`,
      ip,
    });
    if ((ban.type === 'small' || ban.type === 'big') && !user.ignoreIpBans) {
      throw new ForbiddenError(`شما دیگر به این سرویس دسترسی ندارید. ${CONTACT_MODS}`);
    }
    if (ban.type === 'tiny' && ban.until) {
      throw new ForbiddenError(
        `آدرس IP شما موقتاً محدود شده است. ${CONTACT_MODS} محدودیت شما در ${formatDateTime(ban.until)} تمام می‌شود.`
      );
    }
  }

  if (user.isBanned) {
    throw new ForbiddenError(`حساب شما مسدود شده است. ${CONTACT_MODS}`);
  }

  await recordConnectionForAuth(user.id, ip);

  if (user.timeoutUntil && new Date(user.timeoutUntil) > new Date()) {
    throw new ForbiddenError(
      `حساب شما موقتاً محدود شده است. ${CONTACT_MODS} محدودیت شما در ${formatDateTime(user.timeoutUntil)} تمام می‌شود.`
    );
  }

  await startUserSession(user.id);
  logEvent(EVENTS.AUTH_LOGIN, { userId: user.id });
  return { username: user.username };
}

export async function signOut(): Promise<void> {
  await endUserSession();
}

/* ------------------------------------------------------------------ *
 * Email tokens: verification and password reset
 * ------------------------------------------------------------------ */

const hashToken = (token: string) => createHash('sha256').update(token).digest('hex');

async function sendEmailToken(userId: number, username: string, email: string, purpose: EmailTokenPurpose) {
  await enforceRateLimit('EMAIL_GLOBAL_DAILY');

  const token = randomBytes(32).toString('hex');
  await prisma.$transaction([
    // One live token per purpose: a new email invalidates the previous link.
    prisma.emailToken.deleteMany({ where: { userId, purpose } }),
    prisma.emailToken.create({
      data: { userId, purpose, email, tokenHash: hashToken(token), expiresAt: new Date(Date.now() + TOKEN_LIFETIME_MS) },
    }),
  ]);

  const path =
    purpose === 'verify'
      ? `${routes.verifyAccount}/${encodeURIComponent(username)}/${token}`
      : `${routes.resetPassword}/${encodeURIComponent(username)}/${token}`;
  const link = absoluteUrl(path, appUrl());
  await sendMail(purpose === 'verify' ? verificationEmail(email, username, link) : passwordResetEmail(email, username, link));
}

/** Consumes a token: valid, unexpired, for this purpose and this username. Returns its row. */
async function consumeEmailToken(username: string, token: string, purpose: EmailTokenPurpose) {
  const row = await prisma.emailToken.findUnique({
    where: { tokenHash: hashToken(token) },
    select: { id: true, userId: true, email: true, purpose: true, expiresAt: true, user: { select: { username: true } } },
  });
  if (
    !row ||
    row.purpose !== purpose ||
    row.expiresAt < new Date() ||
    row.user.username.toLowerCase() !== username.toLowerCase()
  ) {
    return null;
  }
  await prisma.emailToken.delete({ where: { id: row.id } });
  return row;
}

/** Is this reset link still usable? For the reset page, before showing the form. */
export async function isPasswordResetLinkValid(username: string, token: string): Promise<boolean> {
  if (!/^[a-f0-9]{64}$/.test(token)) return false;
  const row = await prisma.emailToken.findUnique({
    where: { tokenHash: hashToken(token) },
    select: { purpose: true, expiresAt: true, user: { select: { username: true, staffRole: true } } },
  });
  return Boolean(
    row &&
      row.purpose === 'reset_password' &&
      row.expiresAt > new Date() &&
      row.user.username.toLowerCase() === username.toLowerCase() &&
      !row.user.staffRole
  );
}

/** Public: sends a reset link to a verified address. */
export async function requestPasswordReset(input: z.output<typeof requestPasswordResetInput>): Promise<void> {
  await enforceRateLimit('PASSWORD_RESET_ACCOUNT', input.email.toLowerCase());
  const user = await findCredentialsByVerifiedEmailForAuth(input.email);
  if (!user || !user.email) {
    throw new NotFoundError('حسابی با این ایمیل تأییدشده پیدا نشد.');
  }
  await sendEmailToken(user.id, user.username, user.email, 'reset_password');
  logEvent(EVENTS.AUTH_PASSWORD_RESET_REQUESTED, { userId: user.id });
}

/**
 * Public: the token is the credential. Staff accounts cannot be reset by
 * email (legacy rule) — a stolen mailbox must not hand over a moderator.
 */
export async function resetPassword(input: z.output<typeof resetPasswordInput>): Promise<{ username: string }> {
  const row = await consumeEmailToken(input.username, input.token, 'reset_password');
  if (!row) throw new ValidationError('این لینک نامعتبر است یا منقضی شده.');

  const user = await findCredentialsByIdForAuth(row.userId);
  if (!user || user.staffRole) throw new NotFoundError('حساب کاربری یافت نشد');

  await updatePasswordHashForAuth(user.id, await bcrypt.hash(input.password, BCRYPT_ROUNDS));
  await prisma.emailToken.deleteMany({ where: { userId: user.id, purpose: 'reset_password' } });
  logEvent(EVENTS.AUTH_PASSWORD_RESET, { userId: user.id });

  await startUserSession(user.id);
  return { username: user.username };
}

/**
 * Verifies the signed-in user's email. The link must belong to the
 * signed-in account (legacy required a session too).
 */
export async function verifyEmail(input: z.output<typeof verifyEmailInput>): Promise<boolean> {
  const userId = await requireUserId();
  const row = await consumeEmailToken(input.username, input.token, 'verify');
  if (!row || row.userId !== userId) return false;
  const ok = await markEmailVerifiedForAuth(userId, row.email);
  if (ok) logEvent(EVENTS.AUTH_EMAIL_VERIFIED, { userId });
  return ok;
}

/** Re-sends the verification email to the signed-in user's address. */
export async function requestVerification(): Promise<void> {
  const userId = await requireUserId();
  const user = await findCredentialsByIdForAuth(userId);
  if (!user) throw new NotFoundError('حساب کاربری یافت نشد');
  if (!user.email) throw new ValidationError('ابتدا یک ایمیل به حساب خود اضافه کنید.');
  if (user.verified) throw new ConflictError('حساب شما قبلاً تأیید شده است.');
  await sendEmailToken(user.id, user.username, user.email, 'verify');
}

/* ------------------------------------------------------------------ *
 * Account changes (signed in)
 * ------------------------------------------------------------------ */

export async function changePassword(input: z.output<typeof changePasswordInput>): Promise<void> {
  const userId = await requireUserId();
  await updatePasswordHashForAuth(userId, await bcrypt.hash(input.newPassword, BCRYPT_ROUNDS));
  logEvent(EVENTS.AUTH_PASSWORD_CHANGED, { userId });
}

/** Sets (or clears) the email and sends a verification link to a new address. */
export async function changeEmail(input: z.output<typeof changeEmailInput>): Promise<void> {
  const userId = await requireUserId();
  const user = await findCredentialsByIdForAuth(userId);
  if (!user) throw new NotFoundError('حساب کاربری یافت نشد');

  const email = input.email ?? null;
  if (email) {
    if (isProduction() && (await isDisposableEmail(email))) {
      throw new ValidationError('فقط ایمیل‌های غیرموقت برای تأیید حساب پذیرفته می‌شوند.', {
        email: ['ایمیل موقت پذیرفته نمی‌شود'],
      });
    }
    if (await isEmailTakenForAuth(email, userId)) {
      throw new ConflictError('این ایمیل توسط حساب تأییدشده‌ی دیگری استفاده می‌شود.');
    }
  }

  await updateEmailForAuth(userId, email);
  if (email) await sendEmailToken(userId, user.username, email, 'verify');
}

/** Deleting the account requires the password again (legacy). */
export async function deleteAccount(input: z.output<typeof deleteAccountInput>): Promise<void> {
  const userId = await requireUserId();
  const user = await findCredentialsByIdForAuth(userId);
  if (!user || !(await bcrypt.compare(input.password, user.passwordHash))) {
    throw new UnauthorizedError('رمز عبور صحیح نیست.');
  }
  await deleteUserForAuth(userId);
  await endUserSession();
  logEvent(EVENTS.AUTH_ACCOUNT_DELETED, { userId });
}
