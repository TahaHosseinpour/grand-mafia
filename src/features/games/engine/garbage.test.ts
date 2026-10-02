import { beforeEach, describe, expect, it, vi } from 'vitest';
import { resetEngine } from '@/test/fake-hub';
import { world } from '@/test/world';
import { handleAddNewGame } from './create-game';
import { collectGames } from './garbage';
import { sendUserGameSettings } from './presence';
import { engineStore } from './store';

async function tableWithOnePlayer() {
  const hub = resetEngine();
  world.addAccount('sara');
  const socket = hub.connect('sara');
  await sendUserGameSettings(socket);
  await handleAddNewGame(socket, { username: 'sara' }, { gameName: 'table' });
  const game = [...engineStore().games.values()][0];
  return { hub, socket, game };
}

describe('collecting games', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  it('keeps a game people are still in', async () => {
    const { game } = await tableWithOnePlayer();

    collectGames(Date.now() + 60 * 60 * 1000);

    expect(engineStore().games.has(game.general.uid)).toBe(true);
  });

  it('removes a finished game two minutes after it ended, sending its players to the lobby', async () => {
    const { game, socket } = await tableWithOnePlayer();
    game.gameState.isCompleted = 'liberal';
    game.gameState.timeCompleted = Date.now();

    collectGames(Date.now() + 119_000);
    expect(engineStore().games.has(game.general.uid)).toBe(true);

    collectGames(Date.now() + 121_000);
    // The game is stored first, then dropped.
    await vi.advanceTimersByTimeAsync(0);

    expect(engineStore().games.has(game.general.uid)).toBe(false);
    expect(socket.received('toLobby')).toEqual([game.general.uid]);
    expect(socket.rooms.has(game.general.uid)).toBe(false);
    expect(world.savedGames.some((record) => record.uid === game.general.uid)).toBe(true);
  });

  it('removes a game everyone abandoned', async () => {
    const { game } = await tableWithOnePlayer();
    game.general.timeAbandoned = new Date();

    collectGames(Date.now() + 121_000);
    await vi.advanceTimersByTimeAsync(0);

    expect(engineStore().games.has(game.general.uid)).toBe(false);
  });

  it('keeps a finished game a moderator asked to hold', async () => {
    const { game } = await tableWithOnePlayer();
    game.gameState.isCompleted = 'fascist';
    game.gameState.timeCompleted = Date.now();
    game.general.modDeleteDelay = new Date();

    collectGames(Date.now() + 10 * 60 * 1000);

    expect(engineStore().games.has(game.general.uid)).toBe(true);
  });
});
