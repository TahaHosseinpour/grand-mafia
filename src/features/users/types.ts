import type { Serializable } from '@/server/types';
import type { StaffRole } from '@/lib/prisma-enums';

/** The signed-in user's own account, for the account page. */
export type AccountDTO = {
  username: string;
  email: string | null;
  verified: boolean;
  createdAt: string;
};

/**
 * What the auth flow needs to check a sign-in. Contains the password hash:
 * **never** returned from an action, route or page — it stays inside the
 * auth dal.
 */
export type CredentialsForAuth = {
  id: number;
  username: string;
  passwordHash: string;
  email: string | null;
  verified: boolean;
  isBanned: boolean;
  timeoutUntil: string | null;
  staffRole: StaffRole | null;
  ignoreIpBans: boolean;
};

type AssertSerializable<T extends Serializable> = T;
export type _PlainDataChecks = [AssertSerializable<AccountDTO>, AssertSerializable<CredentialsForAuth>];
