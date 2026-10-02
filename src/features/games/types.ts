import type { Serializable } from '@/server/types';

/** A finished (or abandoned) game as stored: the rows of the `games` table. */
export type FinishedGameRecord = {
  uid: string;
  name: string;
  flag: string | null;
  season: number;
  playerCount: number;
  playerChats: string | null;
  winningPlayers: string[];
  losingPlayers: string[];
  winningTeam: string | null;
  isRainbow: boolean;
  eloMinimum: number | null;
  casualGame: boolean;
  practiceGame: boolean;
  customGame: boolean;
  unlistedGame: boolean;
  isVerifiedOnly: boolean;
  completed: boolean;
  /** Everything else the engine recorded about the game's options. */
  settings: Record<string, Serializable>;
  chats: Serializable;
  hiddenInfoChat: Serializable;
  summary: Serializable | null;
};

type AssertSerializable<T extends Serializable> = T;
export type _PlainDataChecks = [AssertSerializable<FinishedGameRecord>];
