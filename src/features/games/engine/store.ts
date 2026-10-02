import { nullHub, type Hub } from './hub';
import type { Game } from './types';
import type { StaffRole } from '@/lib/prisma-enums';

/**
 * The engine's in-memory state: live games, who is online, the general chat.
 *
 * One object per process, parked on `globalThis` under a registered symbol.
 * The custom server (Socket.IO handlers, loaded by tsx) and Next's bundled
 * route handlers each get their own copy of this *module*; the symbol makes
 * them share one *state*. A restart drops everything, as it always did.
 */

/** Who is connected (legacy `userList`), as sent to every client. */
export type OnlineUser = {
  userName: string;
  playerPronouns?: string;
  staffRole: StaffRole | '';
  isContributor: boolean;
  staffDisableVisibleElo?: boolean;
  staffDisableVisibleXP?: boolean;
  staffDisableStaffColor?: boolean;
  staffIncognito?: boolean;
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
  isPrivate?: boolean;
  tournyWins: number[];
  blacklist: { userName: string; reason: string; timestamp: number }[];
  customCardback?: string;
  customCardbackUid?: string;
  previousSeasonAward?: string;
  specialTournamentStatus?: string;
  eloOverall: number;
  xpOverall: number;
  eloSeason: number;
  xpSeason: number;
  status: { type: string; gameId: string | false | null };
  timeLastGameCreated?: number;
  lastMessage?: { time?: Date | number; timestamp?: Date | number; chat?: string };
};

export type GeneralChatLine = {
  time: Date;
  chat: string;
  userName: string;
  staffRole: string;
  hiddenUsername?: string;
};

/** Switches moderators flip at runtime (mirrored from `global_settings`). */
export type EngineFlags = {
  accountCreationDisabled: boolean;
  gameCreationDisabled: boolean;
  limitNewPlayers: boolean;
  ipbansNotEnforced: boolean;
};

export type EngineStore = {
  hub: Hub;
  games: Map<string, Game>;
  userList: OnlineUser[];
  generalChats: { sticky: string; list: GeneralChatLine[]; lastModPing?: number };
  flags: EngineFlags;
  /** Lists changed since the last broadcast; the emitter loop sends them. */
  dirty: { gameList: boolean; userList: boolean };
  timers: { started: boolean };
};

const KEY = Symbol.for('grand-mafia.engine-store');

function createStore(): EngineStore {
  return {
    hub: nullHub,
    games: new Map(),
    userList: [],
    generalChats: { sticky: '', list: [] },
    flags: { accountCreationDisabled: false, gameCreationDisabled: false, limitNewPlayers: false, ipbansNotEnforced: false },
    dirty: { gameList: false, userList: false },
    timers: { started: false },
  };
}

export function engineStore(): EngineStore {
  const holder = globalThis as unknown as Record<symbol, EngineStore | undefined>;
  return (holder[KEY] ??= createStore());
}

/** Installs the realtime layer; called once when the custom server starts. */
export function setHub(hub: Hub): void {
  engineStore().hub = hub;
}

export const getHub = (): Hub => engineStore().hub;
export const getGames = () => engineStore().games;
export const findGame = (uid: unknown): Game | undefined =>
  typeof uid === 'string' ? engineStore().games.get(uid) : undefined;
