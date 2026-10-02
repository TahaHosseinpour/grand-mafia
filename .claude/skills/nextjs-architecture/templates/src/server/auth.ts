import 'server-only';
import { cache } from 'react';
import { cookies } from 'next/headers';
import { AdminAccessLevel, AdminRole } from '@prisma/client';
import prisma from './db';
import { UnauthorizedError, ForbiddenError } from './errors';
import { EVENTS, logSecurityEvent } from './events';
import { AUTH_COOKIES, verifyAdminToken, verifyUserToken } from './session';
import type { AdminPagePath } from '@/lib/admin-pages';

/**
 * The authorization boundary.
 *
 * 1. These **throw** instead of returning `{ success: false }`. An envelope
 *    has to be checked at every call site; a forgotten check is a silent
 *    authorization bypass no type error catches.
 * 2. Session reads are wrapped in React `cache()`, so repeating a guard in
 *    the factory *and* in the dal within one request costs one lookup.
 *
 * Called from dal functions (the real guarantee) and from the
 * `defineRoute` / `defineAction` factories (a fast filter). Route handlers
 * never import this module directly — ESLint bans it under `src/app/api/**`.
 *
 * Requires these Prisma models (see templates/prisma/auth-models.prisma):
 * `User`, `Admin`, `AdminPermission`, enums `AdminRole`, `AdminAccessLevel`.
 * No admin panel? Delete the admin half and the admin modes in http/action.
 */

/* ------------------------------------------------------------------ *
 * User identity
 * ------------------------------------------------------------------ */

export interface Session {
  userId: number;
}

/**
 * The current user, or null.
 *
 * Confirms the row still exists: a token stays cryptographically valid after
 * the account is deleted, and without this a deleted account keeps working
 * until the token expires.
 */
export const getSession = cache(async (): Promise<Session | null> => {
  const token = (await cookies()).get(AUTH_COOKIES.USER)?.value;
  if (!token) return null;

  const decoded = verifyUserToken(token);
  if (!decoded) return null;

  const user = await prisma.user.findUnique({ where: { id: decoded.userId }, select: { id: true } });
  if (!user) return null;

  return { userId: decoded.userId };
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

/* ------------------------------------------------------------------ *
 * Admin identity — a separate system, not a role on User
 *
 * Own table, own cookie, own RBAC keyed on admin **page path**. Nothing about
 * it goes through the user session above.
 * ------------------------------------------------------------------ */

export interface AdminSession {
  adminId: number;
  role: string;
  /**
   * Carried rather than folded into `null`: a deactivated admin must get 403,
   * not 401 — a 401 sends the panel into a redirect loop through the login.
   */
  isActive: boolean;
}

export const getAdminSession = cache(async (): Promise<AdminSession | null> => {
  const token = (await cookies()).get(AUTH_COOKIES.ADMIN)?.value;
  if (!token) return null;

  const decoded = verifyAdminToken(token);
  if (!decoded) return null;

  const admin = await prisma.admin.findUnique({
    where: { id: decoded.adminId },
    select: { id: true, role: true, isActive: true },
  });
  if (!admin) return null;

  return { adminId: admin.id, role: admin.role, isActive: admin.isActive };
});

/** An authenticated, active admin — no page permission checked yet. */
export async function requireAdmin(): Promise<AdminSession> {
  const session = await getAdminSession();
  if (!session) throw new UnauthorizedError('لطفاً وارد پنل مدیریت شوید');
  if (!session.isActive) {
    logSecurityEvent(EVENTS.SECURITY_FORBIDDEN, { adminId: session.adminId, reason: 'inactive' });
    throw new ForbiddenError('حساب شما غیرفعال شده است');
  }
  return session;
}

/**
 * An admin with `access` on one admin page. **The real admin boundary.**
 *
 * `page` is typed `AdminPagePath`: a typo is a compile error and adding a page
 * needs no migration. A super admin passes every page; anyone else needs a
 * permission row — `'read'` accepts read or full, `'full'` only full.
 *
 * A database error propagates as a 500. Swallowing it into `false` would turn
 * a database blip into "you lack access", which is a lie.
 */
export async function requireAdminPermission(
  page: AdminPagePath,
  access: 'read' | 'full' = 'read'
): Promise<AdminSession> {
  const session = await requireAdmin();
  if (isSuperAdmin(session.role)) return session;

  const permission = await prisma.adminPermission.findUnique({
    where: { adminId_pagePath: { adminId: session.adminId, pagePath: page } },
    select: { accessLevel: true },
  });

  const level = permission?.accessLevel;
  const allowed =
    access === 'full'
      ? level === AdminAccessLevel.full
      : level === AdminAccessLevel.read || level === AdminAccessLevel.full;

  if (!allowed) {
    logSecurityEvent(EVENTS.SECURITY_FORBIDDEN, {
      adminId: session.adminId,
      reason: 'page_permission',
      page,
      access,
    });
    throw new ForbiddenError('شما دسترسی لازم برای این صفحه را ندارید');
  }

  return session;
}

/**
 * A super admin. Guards the privilege-escalation surface: creating admins,
 * changing roles, rewriting permissions. Those actions are gated by role,
 * never by a page.
 */
export async function requireSuperAdmin(): Promise<AdminSession> {
  const session = await requireAdmin();
  if (!isSuperAdmin(session.role)) {
    logSecurityEvent(EVENTS.SECURITY_FORBIDDEN, { adminId: session.adminId, reason: 'not_super_admin' });
    throw new ForbiddenError('فقط مدیر ارشد به این بخش دسترسی دارد');
  }
  return session;
}

/**
 * Throws if an admin with `targetRole` may not be modified through the panel.
 * Super admin accounts are provisioned out of band; not even another super
 * admin may edit one, so a stolen session cannot rewrite the top accounts.
 */
export function assertAdminIsManageable(targetRole: string): void {
  if (isSuperAdmin(targetRole)) {
    throw new ForbiddenError('حساب مدیر ارشد از طریق پنل قابل تغییر نیست');
  }
}

/** For display only; authorization goes through `requireSuperAdmin`. */
export function isSuperAdminRole(role: string): boolean {
  return isSuperAdmin(role);
}

function isSuperAdmin(role: string): boolean {
  return role === AdminRole.super_admin;
}
