import { describe, expect, it } from 'vitest';
import { eloColor, playerColor } from './player-color';

const base = {
  userName: 'sara',
  staffRole: undefined,
  staffDisableStaffColor: undefined,
  isContributor: undefined,
  wins: 0,
  losses: 0,
  winsSeason: 0,
  lossesSeason: 0,
  isRainbowOverall: false,
  isRainbowSeason: false,
  eloOverall: 1600,
  eloSeason: 1600,
};

describe('playerColor', () => {
  it('leaves a new player plain', () => {
    expect(playerColor(base)).toBeUndefined();
  });

  it('colours staff by role unless they hide it', () => {
    expect(playerColor({ ...base, staffRole: 'admin' })).toBe('#ff4d4d');
    expect(playerColor({ ...base, staffRole: 'moderator', staffDisableStaffColor: true })).toBeUndefined();
    expect(playerColor({ ...base, staffRole: 'trialmod' })).toBeUndefined();
  });

  it('colours a rainbow player by Elo, the season by default', () => {
    expect(playerColor({ ...base, isRainbowSeason: true, eloSeason: 1500 })).toBe(eloColor(1500));
    expect(playerColor({ ...base, isRainbowOverall: true, eloOverall: 2000 }, false)).toBe(eloColor(2000));
  });

  it('matches the legacy Elo scale at its anchors', () => {
    expect(eloColor(1500)).toBe('hsl(108, 100%, 30%)');
    expect(eloColor(1600)).toBe('hsl(108, 100%, 50%)');
    expect(eloColor(2100)).toBe('hsl(252, 100%, 50%)');
    expect(eloColor(9999)).toBe(eloColor(2100));
  });

  it('uses experience and win rate when Elo is hidden', () => {
    expect(playerColor({ ...base, isRainbowSeason: true, winsSeason: 30, lossesSeason: 30 }, true, true)).toBe('rgb(19, 202, 19)');
    expect(playerColor({ ...base, isRainbowSeason: true, winsSeason: 70, lossesSeason: 30 }, true, true)).toBe('rgb(183, 15, 167)');
    expect(playerColor({ ...base, isRainbowSeason: true, winsSeason: 80, lossesSeason: 20 }, true, true)).toBe('rgb(183, 0, 167)');
  });
});
