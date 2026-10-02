import { DEFAULT_ELO, RAINBOW_XP } from '@/lib/game-constants';

/**
 * Elo and XP for a finished ranked game — pure maths, ported from legacy
 * `rateEloGame` (routes/socket/util.js). The persistence is in `dal.ts`.
 */

export type EloGameInfo = {
  playerCount: number;
  rainbowGame: boolean;
  winningTeam: 'liberal' | 'fascist';
  rebalance6p?: boolean;
  rebalance7p?: boolean;
  rebalance9p2f?: boolean;
};

export type EloPlayer = {
  username: string;
  eloOverall: number;
  eloSeason: number;
  xpOverall: number;
  xpSeason: number;
  won: boolean;
};

export type EloChange = {
  change: number;
  changeSeason: number;
  xpChange: number;
  xpChangeSeason: number;
};

/** The advantage, in Elo points, a win probability above one half represents. */
const probToEloPoints = (p: number): number => -400 * Math.log10(1 / p - 1);

/**
 * How much the player count (and any rebalancing) favours the side that won,
 * given perfectly equal teams — measured over the site's history.
 */
function winnerBiasPoints(info: EloGameInfo): number {
  const liberalBias = info.winningTeam === 'liberal' ? 1 : -1;
  const fascistBias = info.winningTeam === 'liberal' ? -1 : 1;

  if (info.rebalance6p) return probToEloPoints(0.5 + 0.03 * fascistBias);
  if (info.rebalance7p) return probToEloPoints(0.5 + 0.01 * fascistBias);
  if (info.rebalance9p2f) return probToEloPoints(0.5 + 0.07 * fascistBias);

  switch (info.playerCount) {
    case 5:
      return probToEloPoints(0.5 + 0.04 * fascistBias);
    case 6:
      return probToEloPoints(0.5 + 0.07 * liberalBias);
    case 7:
      return probToEloPoints(0.5 + 0.02 * fascistBias);
    case 8:
      return probToEloPoints(0.5 + 0.04 * liberalBias);
    case 9:
      return probToEloPoints(0.5 + 0.08 * fascistBias);
    case 10:
      return probToEloPoints(0.5 + 0.04 * fascistBias);
    default:
      return 0;
  }
}

const average = (players: EloPlayer[], pick: (player: EloPlayer) => number): number =>
  players.reduce((sum, player) => sum + pick(player), 0) / players.length;

/**
 * The Elo / XP change for every player. Elo is conserved between the teams
 * (the winners gain what the losers lose); XP is a small award for playing.
 */
export function computeEloChanges(info: EloGameInfo, players: EloPlayer[]): Map<string, EloChange> {
  // The maximum change is `k`: bigger for rainbow games, shared across the team.
  const k = info.playerCount * (info.rainbowGame ? 9 : 4);

  const winners = players.filter((player) => player.won);
  const losers = players.filter((player) => !player.won);
  if (!winners.length || !losers.length) return new Map();

  const winnersOverall = average(winners, (p) => p.eloOverall || DEFAULT_ELO);
  const winnersSeason = average(winners, (p) => p.eloSeason || DEFAULT_ELO);
  const losersOverall = average(losers, (p) => p.eloOverall || DEFAULT_ELO);
  const losersSeason = average(losers, (p) => p.eloSeason || DEFAULT_ELO);

  const bias = winnerBiasPoints(info);
  const winFactor = k / winners.length;
  const loseFactor = -k / (info.playerCount - winners.length);

  // `p` is how surprising this result was given the teams' ratings. The bias
  // sits inside the sigmoid so Elo stays conserved even with lopsided teams.
  const p = 1 / (1 + 10 ** ((winnersOverall - losersOverall + bias) / 400));
  const pSeason = 1 / (1 + 10 ** ((winnersSeason - losersSeason + bias) / 400));

  const changes = new Map<string, EloChange>();
  for (const player of players) {
    const factor = player.won ? winFactor : loseFactor;
    const change = p * factor;
    const changeSeason = pSeason * factor;
    changes.set(player.username, {
      change,
      changeSeason,
      xpChange: change > 0 ? change / 1.5 : 1,
      xpChangeSeason: changeSeason > 0 ? changeSeason / 1.5 : 1,
    });
  }
  return changes;
}

export const isRainbowXp = (xp: number): boolean => xp >= RAINBOW_XP;
