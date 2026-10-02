import type { Serializable } from '@/server/types';

/** One player's numbers after a game, mirrored into the online list and the game chat. */
export type PlayerRatingAfterGame = {
  username: string;
  eloOverall: number;
  eloSeason: number;
  xpOverall: number;
  xpSeason: number;
  isRainbowOverall: boolean;
  isRainbowSeason: boolean;
  wins: number;
  losses: number;
  rainbowWins: number;
  rainbowLosses: number;
  winsSeason: number;
  lossesSeason: number;
  rainbowWinsSeason: number;
  rainbowLossesSeason: number;
  /** Their own display preferences, which decide which Elo line they see first. */
  disableSeasonal: boolean;
  disableElo: boolean;
  change: number;
  changeSeason: number;
  xpChange: number;
  xpChangeSeason: number;
};

type AssertSerializable<T extends Serializable> = T;
export type _PlainDataChecks = [AssertSerializable<PlayerRatingAfterGame>];
