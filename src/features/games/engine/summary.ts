import type { CustomGameSettings, PolicyName, RoleName } from './types';

/**
 * The game's turn-by-turn record (legacy `GameSummaryBuilder` +
 * `models/game-summary`). It is written as the game is played and saved with
 * the finished game; profile statistics are computed from it.
 */

export type SummaryPlayer = { username: string; role: RoleName; icon?: number };

export type SummaryLog = {
  // election
  presidentId?: number;
  chancellorId?: number;
  votes?: (boolean | undefined)[];
  // policy enactment
  presidentHand?: PolicyName[];
  chancellorHand?: PolicyName[];
  enactedPolicy?: PolicyName;
  presidentClaim?: PolicyName[];
  chancellorClaim?: PolicyName[];
  presidentVeto?: boolean;
  chancellorVeto?: boolean;
  // actions
  policyPeek?: PolicyName[];
  policyPeekClaim?: PolicyName[];
  investigatorId?: number;
  investigationId?: number;
  investigationClaim?: string;
  specialElection?: number;
  execution?: number;
  assassination?: number;
  // metadata
  deckState?: PolicyName[];
};

export type SummarySettings = {
  rebalance6p?: boolean;
  rebalance7p?: boolean;
  rebalance9p?: boolean;
  rerebalance9p?: boolean;
  casualGame: boolean;
  practiceGame: boolean;
  unlistedGame: boolean;
  avalonSH: { withPercival: boolean } | null;
  monarchistSH: boolean;
  noTopdecking?: number;
};

export type Elo = { overall: number; season: number };

/** The plain, serialisable form stored with a finished game. */
export type GameSummaryData = {
  id: string;
  date: string;
  gameSetting: SummarySettings;
  customGameSettings: CustomGameSettings;
  players: SummaryPlayer[];
  libElo: Elo;
  fasElo: Elo;
  logs: SummaryLog[];
};

function objectContains(log: SummaryLog, attrs: Partial<SummaryLog>): boolean {
  return (Object.keys(attrs) as (keyof SummaryLog)[]).every((key) => log[key] === attrs[key]);
}

export class GameSummary {
  logs: SummaryLog[] = [];

  constructor(
    readonly id: string,
    readonly date: Date,
    readonly gameSetting: SummarySettings,
    readonly customGameSettings: CustomGameSettings,
    readonly players: SummaryPlayer[],
    public libElo: Elo,
    public fasElo: Elo
  ) {}

  /**
   * Merges `update` into the latest turn — or into the latest turn matching
   * `target` (used to attach claims to the right turn). Returns `this`.
   */
  updateLog(update: SummaryLog, target?: Partial<SummaryLog>): this {
    if (!this.logs.length) return this;
    let index = this.logs.length - 1;
    if (target) {
      for (let i = this.logs.length - 1; i >= 0; i--) {
        if (objectContains(this.logs[i], target)) {
          index = i;
          break;
        }
      }
    }
    this.logs[index] = { ...this.logs[index], ...update };
    return this;
  }

  nextTurn(): this {
    this.logs.push({});
    return this;
  }

  publish(): GameSummaryData {
    return {
      id: this.id,
      date: this.date.toISOString(),
      gameSetting: this.gameSetting,
      customGameSettings: this.customGameSettings,
      players: this.players,
      libElo: this.libElo,
      fasElo: this.fasElo,
      logs: structuredClone(this.logs),
    };
  }
}
