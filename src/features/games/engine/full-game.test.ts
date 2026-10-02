import { beforeEach, describe, expect, it, vi } from 'vitest';
import { playToTheEnd, seededRandom } from '@/test/bots';
import { resetEngine, type FakeHub, type FakeSocket } from '@/test/fake-hub';
import { world } from '@/test/world';
import { handleAddNewGame } from './create-game';
import { handleSeatRequest } from './join-game';
import { sendUserGameSettings } from './presence';
import { sendGameInfo } from './requests';
import { engineStore } from './store';
import type { Game } from './types';

/**
 * Whole games, played by bots through the same engine calls the sockets make,
 * on fake timers (a real game is minutes of animation delays).
 */

const NAMES = ['alice', 'bob', 'carol', 'dave', 'erin', 'frank', 'grace', 'heidi', 'ivan', 'judy'];

type Table = { hub: FakeHub; game: Game; sockets: FakeSocket[] };

/** Connects `count` players, one creates a game, the rest sit, the countdown runs and the game starts. */
async function seatTable(count: number, options: Record<string, unknown> = {}, seed = count): Promise<Table> {
  // Roles, deck and every random pick the engine makes come from this seed, so a failing game replays exactly.
  vi.spyOn(Math, 'random').mockImplementation(seededRandom(seed));
  const hub = resetEngine();
  const names = NAMES.slice(0, count);
  const sockets = names.map((name) => {
    world.addAccount(name);
    return hub.connect(name);
  });
  for (const socket of sockets) await sendUserGameSettings(socket);

  await handleAddNewGame(sockets[0], { username: names[0] }, { gameName: 'test table', minPlayersCount: count, maxPlayersCount: count, ...options });
  const game = [...engineStore().games.values()][0];
  expect(game, 'the creator gets a table').toBeDefined();

  for (const [index, socket] of sockets.entries()) {
    if (index === 0) continue;
    await handleSeatRequest(socket, { username: names[index] }, { uid: game.general.uid });
    // After `updateSeatForUser` the client opens the table: that is what puts the socket in the game's room.
    sendGameInfo(socket, game.general.uid);
  }
  expect(game.publicPlayersState).toHaveLength(count);

  // The countdown (five seconds) and the dealing of the roles.
  vi.advanceTimersByTime(60_000);
  expect(game.gameState.isStarted).toBe(true);
  return { hub, game, sockets };
}

const rolesOf = (game: Game) => game.private.seatedPlayers.map((seat) => seat.role.cardName);

describe('a game at the table', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  it.each([
    [5, 1],
    [6, 1],
    [7, 2],
    [8, 2],
    [9, 3],
    [10, 3],
  ])('deals the right roles to %i players (%i plain fascists plus Hitler)', async (count, fascists) => {
    const { game } = await seatTable(count);
    const roles = rolesOf(game);

    expect(roles.filter((role) => role === 'hitler')).toHaveLength(1);
    expect(roles.filter((role) => role === 'fascist')).toHaveLength(fascists);
    expect(roles.filter((role) => role === 'liberal')).toHaveLength(count - fascists - 1);
    expect(game.private.seatedPlayers.every((seat) => seat.playersState.length === count)).toBe(true);
  });

  it('lets Hitler know the fascist in a 5-player game, and a liberal know nobody', async () => {
    const { game } = await seatTable(5);
    const seats = game.private.seatedPlayers;
    const fascist = seats.find((seat) => seat.role.cardName === 'fascist')!;
    const hitler = seats.find((seat) => seat.role.cardName === 'hitler')!;
    const liberal = seats.find((seat) => seat.role.cardName === 'liberal')!;

    expect(fascist.playersState[seats.indexOf(hitler)].nameStatus).toBe('hitler');
    expect(hitler.playersState[seats.indexOf(fascist)].nameStatus).toBe('fascist');

    const others = liberal.playersState.filter((_, i) => seats[i] !== liberal);
    expect(others.every((view) => !view.nameStatus)).toBe(true);
  });

  it('keeps the fascists hidden from Hitler in a 7-player game', async () => {
    const { game } = await seatTable(7);
    const seats = game.private.seatedPlayers;
    const hitler = seats.find((seat) => seat.role.cardName === 'hitler')!;
    const fascists = seats.filter((seat) => seat.role.cardName === 'fascist');

    for (const fascist of fascists) {
      expect(fascist.playersState[seats.indexOf(hitler)].nameStatus).toBe('hitler');
      for (const other of fascists.filter((candidate) => candidate !== fascist)) {
        expect(fascist.playersState[seats.indexOf(other)].nameStatus).toBe('fascist');
      }
    }
    const others = hitler.playersState.filter((_, i) => seats[i] !== hitler);
    expect(others.every((view) => !view.nameStatus)).toBe(true);
  });

  it("never sends a liberal anyone's secret role in the game update", async () => {
    const { game, sockets } = await seatTable(7);
    const seats = game.private.seatedPlayers;

    for (const socket of sockets) {
      const seat = seats.find((candidate) => candidate.userName === socket.username)!;
      const update = socket.lastReceived('gameUpdate');
      expect(update, 'every seat has been sent the table').toBeDefined();
      expect(update).not.toHaveProperty('private');

      if (seat.role.team !== 'liberal') continue;
      // Role cards carry a `cardName`; a liberal's update holds their own and no other.
      const json = JSON.stringify(update);
      expect(json).not.toContain('"cardName":"hitler"');
      expect(json).not.toContain('"cardName":"fascist"');
    }
  });

  it.each([5, 6, 7, 8, 9, 10])('plays a %i-player game to a winner', async (count) => {
    const { game, hub } = await seatTable(count);

    const result = playToTheEnd({ game, hub, rng: seededRandom(count) });

    expect(result.completed, `stalled after ${result.journal.length} actions: ${result.journal.slice(-6).join(', ')}`).toBe(true);
    expect(['liberal', 'fascist']).toContain(game.gameState.isCompleted);

    const { liberal, fascist } = game.trackState.liberalPolicyCount !== undefined ? { liberal: game.trackState.liberalPolicyCount, fascist: game.trackState.fascistPolicyCount } : { liberal: 0, fascist: 0 };
    expect(liberal).toBeLessThanOrEqual(5);
    expect(fascist).toBeLessThanOrEqual(6);

    // The game is stored once, with its winners and losers.
    vi.advanceTimersByTime(5 * 60 * 1000);
    const saved = world.savedGames.filter((record) => record.uid === game.general.uid);
    expect(saved.length).toBeGreaterThanOrEqual(1);
    const record = saved[saved.length - 1];
    expect(record.winningTeam).toBe(game.gameState.isCompleted);
    expect(record.winningPlayers.length + record.losingPlayers.length).toBe(count);
    expect(new Set([...record.winningPlayers, ...record.losingPlayers]).size).toBe(count);
  });

  it('rates a ranked game: Elo is conserved and every player is credited', async () => {
    const { game, hub } = await seatTable(7);
    const before = [...world.accounts.values()].reduce((sum, account) => sum + account.eloOverall, 0);

    expect(playToTheEnd({ game, hub, rng: seededRandom(7) }).completed).toBe(true);
    vi.advanceTimersByTime(1000);
    await vi.runAllTimersAsync();

    expect(world.rankedResults).toHaveLength(1);
    const [result] = world.rankedResults;
    expect(result.players).toHaveLength(7);
    expect(result.winners.length).toBeGreaterThan(0);
    expect(result.winners.length).toBeLessThan(7);

    const after = [...world.accounts.values()].reduce((sum, account) => sum + account.eloOverall, 0);
    expect(after).toBeCloseTo(before, 6);
    expect([...world.accounts.values()].reduce((sum, a) => sum + a.wins + a.losses, 0)).toBe(7);
  });

  it('does not rate a casual game', async () => {
    const { game, hub } = await seatTable(5, { gameType: 'casual', casualGame: true });

    expect(playToTheEnd({ game, hub, rng: seededRandom(55) }).completed).toBe(true);
    await vi.runAllTimersAsync();

    expect(world.rankedResults).toHaveLength(0);
  });

  it('refuses a vote from a player who is not at the table', async () => {
    const { game, hub } = await seatTable(5);
    const { selectVoting } = await import('./election');

    // Run until a vote is open.
    for (let i = 0; i < 400 && game.gameState.phase !== 'voting'; i++) {
      const { act } = await import('@/test/bots');
      act({ game, hub, rng: seededRandom(i) }, new Set(), [], { useVeto: false });
      vi.advanceTimersByTime(250);
    }
    expect(game.gameState.phase).toBe('voting');

    selectVoting({ username: 'mallory' }, game, { vote: true });
    expect(game.private.seatedPlayers.every((seat) => !seat.voteStatus?.hasVoted)).toBe(true);
  });
});

/* ------------------------------------------------------------------ *
 * Every option a table can be created with, each over several seeds
 * ------------------------------------------------------------------ */

const custom = (powers: (string | null)[], fascistCount = 1) => ({
  enabled: true,
  deckState: { lib: 6, fas: 11 },
  trackState: { lib: 0, fas: 0 },
  fascistCount,
  hitlerZone: 3,
  vetoZone: 5,
  powers,
  hitKnowsFas: true,
});

const VARIANTS: [label: string, players: number, options: Record<string, unknown>][] = [
  ['experienced mode', 7, { experiencedMode: true }],
  ['blind mode', 7, { blindMode: true }],
  ['no game chat', 6, { disableGamechat: true }],
  ['Avalon, 5 players', 5, { avalonSH: true }],
  ['Avalon, 7 players', 7, { avalonSH: true }],
  ['Avalon with Percival', 7, { avalonSH: true, withPercival: true }],
  ['Avalon with Percival and the monarchist', 9, { avalonSH: true, withPercival: true, monarchistSH: true }],
  ['monarchist', 8, { monarchistSH: true }],
  ['no topdecking (strict)', 5, { noTopdecking: 1 }],
  ['no topdecking (once)', 7, { noTopdecking: 2 }],
  ['6-player rebalance', 6, { rebalance6p: true }],
  ['7-player rebalance', 7, { rebalance7p: true }],
  ['9-player rebalance', 9, { rebalance9p2f: true }],
  ['timed mode', 5, { timedMode: 30 }],
  ['practice game', 5, { gameType: 'practice' }],
  ['custom: investigate, peek and drop, reverse investigation', 5, { customGameSettings: custom(['investigate', 'peekdrop', 'reverseinv', 'bullet', 'bullet']) }],
  ['custom: two fascists, deck peek, special election', 7, { customGameSettings: custom(['deckpeek', 'election', 'investigate', 'bullet', 'bullet'], 2) }],
];

describe('game options', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  it.each(VARIANTS.flatMap(([label, players, options]) => [1, 2, 3].map((seed) => [label, players, options, seed] as const)))(
    '%s plays to a winner (seed %i)',
    async (_label, players, options, seed) => {
      const { game, hub } = await seatTable(players, options, seed * 31 + players);

      const result = playToTheEnd({ game, hub, rng: seededRandom(seed) });

      expect(result.completed, `stalled in ${game.gameState.phase}: ${game.general.status} (last: ${result.journal.slice(-3).join(', ')})`).toBe(true);
      expect(['liberal', 'fascist']).toContain(game.gameState.isCompleted);
    }
  );

  it('deals Merlin and Morgana to a small Avalon table every time', async () => {
    for (const seed of [1, 2, 3, 4, 5, 6]) {
      const { game } = await seatTable(5, { avalonSH: true, withPercival: true }, seed);
      const roles = rolesOf(game);
      expect(roles, `seed ${seed}`).toContain('merlin');
      expect(roles, `seed ${seed}`).toContain('percival');
      expect(roles, `seed ${seed}`).toContain('morgana');
      vi.clearAllTimers();
    }
  });
});

