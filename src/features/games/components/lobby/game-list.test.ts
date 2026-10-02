import { describe, expect, it } from 'vitest';
import { isHidden, sortGames } from './game-list';
import type { GameListItem } from '../wire';

const game = (patch: Partial<GameListItem>): GameListItem =>
  ({
    name: 'table',
    uid: 'u',
    userNames: [],
    gameStatus: 'notStarted',
    seatedCount: 1,
    minPlayersCount: 5,
    maxPlayersCount: 10,
    ...patch,
  }) as GameListItem;

describe('isHidden', () => {
  it('shows everything with no filters on', () => {
    expect(isHidden(game({}))).toBe(false);
  });

  it('hides each kind its filter names', () => {
    expect(isHidden(game({ private: true }), { priv: true })).toBe(true);
    expect(isHidden(game({}), { pub: true })).toBe(true);
    expect(isHidden(game({ gameStatus: 'liberal' }), { completed: true })).toBe(true);
    expect(isHidden(game({ gameStatus: 'isStarted' }), { inprogress: true })).toBe(true);
    expect(isHidden(game({ casualGame: true }), { casualgame: true })).toBe(true);
    expect(isHidden(game({ rainbowgame: true }), { standard: true })).toBe(false);
  });
});

describe('sortGames', () => {
  it('puts my own table first, then waiting, running and finished tables', () => {
    const sorted = sortGames(
      [
        game({ uid: 'done', gameStatus: 'fascist' }),
        game({ uid: 'running', gameStatus: 'isStarted' }),
        game({ uid: 'waiting' }),
        game({ uid: 'mine', gameStatus: 'isStarted', userNames: ['sara'] }),
      ],
      { userName: 'sara' } as never
    );
    expect(sorted.map((g) => g.uid)).toEqual(['mine', 'waiting', 'running', 'done']);
  });

  it('puts fuller tables first among the same kind', () => {
    const sorted = sortGames([game({ uid: 'a', seatedCount: 2 }), game({ uid: 'b', seatedCount: 6 })]);
    expect(sorted[0].uid).toBe('b');
  });
});
