import { computeEloChanges } from '@/features/ranking/elo';
import type { PresenceDTO } from '@/features/users';
import type { FinishedGameRecord } from '@/features/games/types';
import type { AutoReportInput } from '@/features/moderation';
import type { RankedGameResult } from '@/features/ranking';
import type { PlayerRatingAfterGame } from '@/features/ranking';

/**
 * The tests' stand-in for PostgreSQL: accounts, finished games and the
 * moderators' inbox, in memory. `setup.ts` points every feature's data layer
 * (`dal.ts`) at this, so the engine runs exactly as in production minus the
 * database.
 */

type Warning = { id: number; text: string; time: string; acknowledged: boolean };

export const world = {
  accounts: new Map<string, PresenceDTO>(),
  warnings: new Map<string, Warning[]>(),
  feedback: [] as { username: string; text: string; at: Date }[],
  savedGames: [] as FinishedGameRecord[],
  rankedResults: [] as RankedGameResult[],
  unrankedResults: [] as { players: string[]; winners: string[] }[],
  reports: [] as AutoReportInput[],
  switches: { ipbansNotEnforced: false, accountCreationDisabled: false, gameCreationDisabled: false, limitNewPlayers: false } as Record<string, boolean>,
  ipBans: new Map<string, { type: string; until: string | null; permanent: boolean }>(),

  reset(): void {
    this.accounts.clear();
    this.warnings.clear();
    this.feedback.length = 0;
    this.savedGames.length = 0;
    this.rankedResults.length = 0;
    this.unrankedResults.length = 0;
    this.reports.length = 0;
    this.ipBans.clear();
    for (const key of Object.keys(this.switches)) this.switches[key] = false;
  },

  /** Adds a player who has agreed to the terms and has no warnings. */
  addAccount(username: string, overrides: Partial<PresenceDTO> = {}): PresenceDTO {
    const account: PresenceDTO = {
      userId: this.accounts.size + 1,
      username,
      staffRole: null,
      isContributor: false,
      isTournamentMod: false,
      verified: true,
      isBanned: false,
      timeoutUntil: null,
      lastConnectedIp: '203.0.113.7',
      touLastAgreed: '1.5',
      hasNotDismissedSignupModal: false,
      lastVersionSeen: null,
      bio: '',
      gameSettings: {},
      wins: 0,
      losses: 0,
      rainbowWins: 0,
      rainbowLosses: 0,
      winsSeason: 0,
      lossesSeason: 0,
      rainbowWinsSeason: 0,
      rainbowLossesSeason: 0,
      isRainbowOverall: false,
      isRainbowSeason: false,
      eloOverall: 1600,
      eloSeason: 1600,
      xpOverall: 0,
      xpSeason: 0,
      ...overrides,
    };
    this.accounts.set(username, account);
    return account;
  },

  account(username: string): PresenceDTO {
    const account = this.accounts.get(username);
    if (!account) throw new Error(`no test account ${username}`);
    return account;
  },

  /** What `applyRankedResultForGameEnd` does to the database, on the in-memory accounts. */
  applyRanked(result: RankedGameResult): PlayerRatingAfterGame[] {
    const players = result.players.flatMap((name) => this.accounts.get(name) ?? []);
    const changes = computeEloChanges(
      result.info,
      players.map((p) => ({
        username: p.username,
        eloOverall: p.eloOverall,
        eloSeason: p.eloSeason,
        xpOverall: p.xpOverall,
        xpSeason: p.xpSeason,
        won: result.winners.includes(p.username),
      }))
    );

    return players.map((p) => {
      const change = changes.get(p.username);
      const won = result.winners.includes(p.username);
      p.eloOverall += change?.change ?? 0;
      p.eloSeason += change?.changeSeason ?? 0;
      p.xpOverall += change?.xpChange ?? 0;
      p.xpSeason += change?.xpChangeSeason ?? 0;
      if (won) {
        p.wins += 1;
        p.winsSeason += 1;
      } else {
        p.losses += 1;
        p.lossesSeason += 1;
      }
      return {
        username: p.username,
        eloOverall: p.eloOverall,
        eloSeason: p.eloSeason,
        xpOverall: p.xpOverall,
        xpSeason: p.xpSeason,
        isRainbowOverall: p.isRainbowOverall,
        isRainbowSeason: p.isRainbowSeason,
        wins: p.wins,
        losses: p.losses,
        rainbowWins: p.rainbowWins,
        rainbowLosses: p.rainbowLosses,
        winsSeason: p.winsSeason,
        lossesSeason: p.lossesSeason,
        rainbowWinsSeason: p.rainbowWinsSeason,
        rainbowLossesSeason: p.rainbowLossesSeason,
        disableSeasonal: Boolean(p.gameSettings.disableSeasonal),
        disableElo: Boolean(p.gameSettings.disableElo),
        change: change?.change ?? 0,
        changeSeason: change?.changeSeason ?? 0,
        xpChange: change?.xpChange ?? 0,
        xpChangeSeason: change?.xpChangeSeason ?? 0,
      };
    });
  },
};
