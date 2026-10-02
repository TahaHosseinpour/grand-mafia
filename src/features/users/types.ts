import type { Serializable } from '@/server/types';
import type { StaffRole } from '@/lib/prisma-enums';
import type { UserGameSettings } from './settings';

/** The signed-in user's own account, for the account page. */
export type AccountDTO = {
  username: string;
  email: string | null;
  verified: boolean;
  createdAt: string;
};

/**
 * What the game client needs about its own player when the page loads
 * (legacy `game.pug` globals): identity and settings. The blacklist is part
 * of the settings; nothing else private is.
 */
export type GameBootstrapDTO = {
  username: string;
  staffRole: StaffRole | null;
  verified: boolean;
  isTournamentMod: boolean;
  hasNotDismissedSignupModal: boolean;
  gameSettings: UserGameSettings;
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

/**
 * Everything the realtime layer needs to know about a connected player: who
 * they are to the lobby (names, colours, ratings) and their saved settings.
 * Never sent to a client as is — the engine copies out the public part.
 */
export type PresenceDTO = {
  userId: number;
  username: string;
  staffRole: StaffRole | null;
  isContributor: boolean;
  isTournamentMod: boolean;
  verified: boolean;
  isBanned: boolean;
  timeoutUntil: string | null;
  lastConnectedIp: string | null;
  touLastAgreed: string | null;
  hasNotDismissedSignupModal: boolean;
  lastVersionSeen: string | null;
  bio: string;
  gameSettings: UserGameSettings;
  wins: number;
  losses: number;
  rainbowWins: number;
  rainbowLosses: number;
  winsSeason: number;
  lossesSeason: number;
  rainbowWinsSeason: number;
  rainbowLossesSeason: number;
  isRainbowOverall: boolean;
  isRainbowSeason: boolean;
  eloOverall: number;
  eloSeason: number;
  xpOverall: number;
  xpSeason: number;
};

type AssertSerializable<T extends Serializable> = T;
export type _PlainDataChecks = [AssertSerializable<GameBootstrapDTO>, AssertSerializable<AccountDTO>, AssertSerializable<CredentialsForAuth>, AssertSerializable<PresenceDTO>];
