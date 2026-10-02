import { describe, expect, it } from 'vitest';
import { LATEST_TOU_VERSION, TOU_CHANGES, pendingTouChanges } from './tou';

describe('pendingTouChanges', () => {
  it('shows a player who never agreed the basic rules only', () => {
    expect(pendingTouChanges(null)).toEqual([TOU_CHANGES[TOU_CHANGES.length - 1]]);
    expect(pendingTouChanges('')).toHaveLength(1);
  });

  it('shows nothing to a player on the latest version', () => {
    expect(pendingTouChanges(LATEST_TOU_VERSION)).toEqual([]);
  });

  it('shows everything newer than the version a player agreed to, newest first', () => {
    expect(pendingTouChanges('1.3').map((change) => change.changeVer)).toEqual(['1.5', '1.4']);
    expect(pendingTouChanges('0.0')).toHaveLength(TOU_CHANGES.length - 1);
  });

  it('compares versions as numbers, not text', () => {
    // "1.10" is newer than "1.5".
    expect(pendingTouChanges('1.10')).toEqual([]);
  });
});
