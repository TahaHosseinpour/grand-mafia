import { describe, expect, it } from 'vitest';
import { computeEloChanges, type EloPlayer } from './elo';

const player = (username: string, won: boolean, elo = 1600): EloPlayer => ({
  username,
  eloOverall: elo,
  eloSeason: elo,
  xpOverall: 0,
  xpSeason: 0,
  won,
});

const table = (liberalsWin: boolean, count = 7, elo = 1600): EloPlayer[] => {
  const fascists = count <= 6 ? 2 : count <= 8 ? 3 : 4;
  return Array.from({ length: count }, (_, i) => player(`p${i}`, i < fascists ? !liberalsWin : liberalsWin, elo));
};

describe('computeEloChanges', () => {
  it('conserves Elo: what the winners gain, the losers lose', () => {
    const players = table(true);
    const changes = computeEloChanges({ playerCount: 7, rainbowGame: false, winningTeam: 'liberal' }, players);
    const total = [...changes.values()].reduce((sum, c) => sum + c.change, 0);
    expect(total).toBeCloseTo(0, 9);
    const seasonTotal = [...changes.values()].reduce((sum, c) => sum + c.changeSeason, 0);
    expect(seasonTotal).toBeCloseTo(0, 9);
  });

  it('rewards winners and charges losers', () => {
    const players = table(false, 5);
    const changes = computeEloChanges({ playerCount: 5, rainbowGame: false, winningTeam: 'fascist' }, players);
    for (const p of players) {
      const { change } = changes.get(p.username)!;
      if (p.won) expect(change).toBeGreaterThan(0);
      else expect(change).toBeLessThan(0);
    }
  });

  it('gives a rainbow game more at stake than a normal one', () => {
    const players = table(true, 7);
    const normal = computeEloChanges({ playerCount: 7, rainbowGame: false, winningTeam: 'liberal' }, players);
    const rainbow = computeEloChanges({ playerCount: 7, rainbowGame: true, winningTeam: 'liberal' }, players);
    expect(rainbow.get('p6')!.change).toBeGreaterThan(normal.get('p6')!.change);
  });

  it('pays more for an upset than for a win expected from the ratings', () => {
    const upset = table(true).map((p, i) => ({ ...p, eloOverall: p.won ? 1400 : 1800, eloSeason: p.won ? 1400 : 1800, username: `u${i}` }));
    const expected = table(true).map((p, i) => ({ ...p, eloOverall: p.won ? 1800 : 1400, eloSeason: p.won ? 1800 : 1400, username: `e${i}` }));
    const info = { playerCount: 7, rainbowGame: false, winningTeam: 'liberal' as const };
    const upsetGain = computeEloChanges(info, upset).get('u6')!.change;
    const expectedGain = computeEloChanges(info, expected).get('e6')!.change;
    expect(upsetGain).toBeGreaterThan(expectedGain);
  });

  it('gives XP: a share of the gain to winners, one point to losers', () => {
    const players = table(true);
    const changes = computeEloChanges({ playerCount: 7, rainbowGame: false, winningTeam: 'liberal' }, players);
    expect(changes.get('p6')!.xpChange).toBeCloseTo(changes.get('p6')!.change / 1.5, 9);
    expect(changes.get('p0')!.xpChange).toBe(1);
  });

  it('does nothing when one side is empty', () => {
    const everyone = Array.from({ length: 5 }, (_, i) => player(`p${i}`, true));
    expect(computeEloChanges({ playerCount: 5, rainbowGame: false, winningTeam: 'liberal' }, everyone).size).toBe(0);
  });
});
