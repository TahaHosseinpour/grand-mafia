import type { formattedGameList, formattedUserList } from '../engine/lists';
import type { GeneralChatLine } from '../engine/store';
import type { Update } from '../engine/updates';
import type { ChatEntry, GameChatLine, PlayerChatLine } from '../engine/types';
import type { UserGameSettings } from '@/features/users';
import type { StaffRole } from '@/lib/prisma-enums';
import type { APP_VERSION } from '@/lib/version';

/**
 * What the game client receives over the socket, typed from the engine that
 * sends it (type imports only: none of the engine reaches the browser).
 * JSON turns every `Date` into a string; `Wire<T>` says so.
 */

export type Wire<T> = T extends Date
  ? string
  : T extends readonly unknown[]
    ? { [K in keyof T]: Wire<T[K]> }
    : T extends object
      ? { [K in keyof T]: Wire<T[K]> }
      : T;

export type GameListItem = Wire<ReturnType<typeof formattedGameList>[number]>;
export type UserListItem = Wire<ReturnType<typeof formattedUserList>[number]>;
export type GeneralChat = Wire<GeneralChatLine>;
export type GeneralChats = { sticky: string; list: GeneralChat[] };
export type GameInfo = Wire<Update>;
export type ChatItem = Wire<ChatEntry>;
export type GameChatItem = Wire<GameChatLine>;
export type PlayerChatItem = Wire<PlayerChatLine>;
export type VersionInfo = { current: typeof APP_VERSION; lastSeen?: string };

export type { UserGameSettings, StaffRole };

/** The signed-in player as the client knows them (legacy `userInfo`). */
export type UserInfo = {
  userName?: string;
  staffRole?: StaffRole | null;
  verified?: boolean;
  isTournamentMod?: boolean;
  hasNotDismissedSignupModal?: boolean;
  gameSettings?: UserGameSettings;
  /** Set once the server confirms a seat (`updateSeatForUser`). */
  isSeated?: boolean;
};

export type TouChange = { changeVer: string; changeDesc: string };
export type WarningPopup = { text: string; time: string };
