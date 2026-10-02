import { beforeEach, describe, expect, it, vi } from 'vitest';
import { resetEngine, type FakeHub, type FakeSocket } from '@/test/fake-hub';
import { world } from '@/test/world';
import { handleAddNewGame } from './create-game';
import { handleSeatRequest } from './join-game';
import { handleSocketDisconnect, handleUserLeaveGame } from './lobby';
import { findOnlineUser } from './lists';
import { sendUserGameSettings } from './presence';
import { sendGameInfo } from './requests';
import { engineStore } from './store';

type Player = { name: string; socket: FakeSocket; caller: { username: string } };

async function lobby(names: string[], accounts: Record<string, Parameters<typeof world.addAccount>[1]> = {}): Promise<{ hub: FakeHub; players: Player[] }> {
  vi.useFakeTimers();
  const hub = resetEngine();
  const players: Player[] = [];
  for (const name of names) {
    world.addAccount(name, accounts[name] ?? {});
    const socket = hub.connect(name);
    await sendUserGameSettings(socket);
    players.push({ name, socket, caller: { username: name } });
  }
  return { hub, players };
}

const create = (player: Player, options: Record<string, unknown> = {}) =>
  handleAddNewGame(player.socket, player.caller, { gameName: 'میز من', ...options });

const games = () => [...engineStore().games.values()];

async function sit(player: Player, uid: string, password?: string) {
  await handleSeatRequest(player.socket, player.caller, { uid, password });
}

describe('creating a game', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  it('puts the creator in a new table, and the table on the list', async () => {
    const { players } = await lobby(['sara']);

    await create(players[0]);

    const [game] = games();
    expect(game.general.name).toBe('میز من');
    expect(game.publicPlayersState.map((seat) => seat.userName)).toEqual(['sara']);
    expect(game.private.gameCreatorName).toBe('sara');
    expect(findOnlineUser('sara')?.status).toMatchObject({ type: 'playing', gameId: game.general.uid });
    expect(players[0].socket.got('updateSeatForUser')).toBe(true);
    expect(players[0].socket.rooms.has(game.general.uid)).toBe(true);
  });

  it('refuses a name with characters the game does not allow', async () => {
    const { players } = await lobby(['sara']);

    await create(players[0], { gameName: 'میز 😀' });
    await create(players[0], { gameName: '' });
    await create(players[0], { gameName: 'x'.repeat(21) });

    expect(games()).toHaveLength(0);
  });

  it('accepts a Persian name', async () => {
    const { players } = await lobby(['sara']);

    await create(players[0], { gameName: 'بازی دوستانه' });

    expect(games()).toHaveLength(1);
  });

  it('allows one table at a time per player', async () => {
    const { players } = await lobby(['sara']);

    await create(players[0]);
    vi.advanceTimersByTime(20_000);
    await create(players[0]);

    expect(games()).toHaveLength(1);
  });

  it('refuses when moderators have switched game creation off', async () => {
    const { players } = await lobby(['sara']);
    engineStore().flags.gameCreationDisabled = true;

    await create(players[0]);

    expect(games()).toHaveLength(0);
  });

  it('refuses a player count range that makes no sense', async () => {
    const { players } = await lobby(['sara']);

    await create(players[0], { minPlayersCount: 9, maxPlayersCount: 6 });

    expect(games()).toHaveLength(0);
  });

  it('refuses an Elo limit above the creator\'s own rating', async () => {
    const { players } = await lobby(['sara']);

    await create(players[0], { eloSliderValue: 1900 });

    expect(games()).toHaveLength(0);
  });

  it('never lets a payload choose who the creator is', async () => {
    const { players } = await lobby(['sara', 'omid']);

    await handleAddNewGame(players[0].socket, players[0].caller, { gameName: 'x', userName: 'omid', creatorName: 'omid' });

    expect(games()[0].private.gameCreatorName).toBe('sara');
    expect(findOnlineUser('omid')?.status.type).toBe('none');
  });
});

describe('taking a seat', () => {
  it('seats a player, up to the table size', async () => {
    const { players } = await lobby(['a', 'b', 'c', 'd', 'e', 'f']);
    await create(players[0], { minPlayersCount: 5, maxPlayersCount: 5 });
    const { uid } = games()[0].general;

    for (const player of players.slice(1)) await sit(player, uid);

    expect(games()[0].publicPlayersState).toHaveLength(5);
    expect(players[5].socket.got('updateSeatForUser')).toBe(false);
  });

  it('does not seat a player twice', async () => {
    const { players } = await lobby(['a', 'b']);
    await create(players[0]);
    const { uid } = games()[0].general;

    await sit(players[1], uid);
    await sit(players[1], uid);

    expect(games()[0].publicPlayersState.map((seat) => seat.userName).sort()).toEqual(['a', 'b']);
  });

  it('asks a private table\'s password, and accepts the creator\'s whitelist', async () => {
    const { players } = await lobby(['a', 'b', 'c', 'd']);
    await create(players[0], { privatePassword: 'secret' });
    const game = games()[0];

    await sit(players[1], game.general.uid);
    await sit(players[1], game.general.uid, 'wrong');
    expect(game.publicPlayersState).toHaveLength(1);

    await sit(players[1], game.general.uid, 'secret');
    expect(game.publicPlayersState).toHaveLength(2);

    game.general.whitelistedPlayers.push('c');
    await sit(players[2], game.general.uid);
    expect(game.publicPlayersState).toHaveLength(3);
  });

  it('never shows the password in the table the others receive', async () => {
    const { players } = await lobby(['a', 'b']);
    await create(players[0], { privatePassword: 'secret-word' });

    const sent = players[0].socket.emitted.map((entry) => JSON.stringify(entry.args)).join('');
    expect(sent).not.toContain('secret-word');
  });

  it('turns away a player on the creator\'s blacklist', async () => {
    const { players } = await lobby(['a', 'b'], {
      a: { gameSettings: { blacklist: [{ userName: 'b', reason: 'rude', timestamp: 1 }] } },
    });
    await create(players[0]);
    const game = games()[0];

    await sit(players[1], game.general.uid);

    expect(game.publicPlayersState).toHaveLength(1);
    expect(players[1].socket.lastReceived('gameJoinStatusUpdate')).toEqual({ status: 'blacklisted' });
  });

  it('keeps out players below the Elo or XP minimum', async () => {
    const { players } = await lobby(['a', 'b'], { a: { eloOverall: 1700, eloSeason: 1700, xpOverall: 50 }, b: { eloOverall: 1500, eloSeason: 1500, xpOverall: 2 } });
    await create(players[0], { eloSliderValue: 1650, xpSliderValue: 10 });
    const game = games()[0];

    await sit(players[1], game.general.uid);

    expect(game.publicPlayersState).toHaveLength(1);
  });

  it('keeps unverified players out of a verified-only table', async () => {
    const { players } = await lobby(['a', 'b', 'c'], { a: { verified: true }, b: { verified: false }, c: { verified: true } });
    await create(players[0], { isVerifiedOnly: true });
    const game = games()[0];

    await sit(players[1], game.general.uid);
    expect(game.publicPlayersState).toHaveLength(1);

    await sit(players[2], game.general.uid);
    expect(game.publicPlayersState).toHaveLength(2);
  });

  it('keeps new players out of public tables while moderators limit them', async () => {
    const { players } = await lobby(['a', 'b'], { a: { wins: 10 }, b: { wins: 0, losses: 1 } });
    await create(players[0]);
    engineStore().flags.limitNewPlayers = true;
    const game = games()[0];

    await sit(players[1], game.general.uid);

    expect(game.publicPlayersState).toHaveLength(1);
  });

  it('refuses a seat once the game has started', async () => {
    const { players } = await lobby(['a', 'b', 'c', 'd', 'e', 'f']);
    await create(players[0], { minPlayersCount: 5, maxPlayersCount: 10 });
    const game = games()[0];
    for (const player of players.slice(1, 5)) await sit(player, game.general.uid);
    vi.advanceTimersByTime(60_000);
    expect(game.gameState.isTracksFlipped).toBe(true);

    await sit(players[5], game.general.uid);

    expect(game.publicPlayersState).toHaveLength(5);
  });

  it('ignores a payload that is not a table', async () => {
    const { players } = await lobby(['a']);

    await handleSeatRequest(players[0].socket, players[0].caller, null);
    await handleSeatRequest(players[0].socket, players[0].caller, { uid: 42 });
    await handleSeatRequest(players[0].socket, players[0].caller, { uid: '__proto__' });

    expect(players[0].socket.got('updateSeatForUser')).toBe(false);
  });
});

describe('the countdown', () => {
  it('starts when enough have sat, and is called off when someone leaves', async () => {
    const { players } = await lobby(['a', 'b', 'c', 'd', 'e']);
    // A table that is not full waits out the countdown, so there is time to leave.
    await create(players[0], { minPlayersCount: 5, maxPlayersCount: 10 });
    const game = games()[0];
    for (const player of players.slice(1, 4)) await sit(player, game.general.uid);
    expect(game.gameState.isStarted).toBeFalsy();

    await sit(players[4], game.general.uid);
    expect(game.gameState.isStarted).toBe(true);

    vi.advanceTimersByTime(2000);
    handleUserLeaveGame(players[4].socket, game, players[4].caller, {});
    vi.advanceTimersByTime(60_000);

    expect(game.gameState.isTracksFlipped).toBeFalsy();
    expect(game.gameState.isStarted).toBeFalsy();
    expect(game.publicPlayersState).toHaveLength(4);
  });

  it('starts at once when the table is full', async () => {
    const { players } = await lobby(['a', 'b', 'c', 'd', 'e']);
    await create(players[0], { minPlayersCount: 5, maxPlayersCount: 5 });
    const game = games()[0];
    for (const player of players.slice(1)) await sit(player, game.general.uid);

    vi.advanceTimersByTime(3000);

    expect(game.gameState.isTracksFlipped).toBe(true);
  });
});

describe('leaving', () => {
  it('takes a player off a table that has not started, and clears their status', async () => {
    const { players } = await lobby(['a', 'b']);
    await create(players[0]);
    const game = games()[0];
    await sit(players[1], game.general.uid);

    handleUserLeaveGame(players[1].socket, game, players[1].caller, {});

    expect(game.publicPlayersState.map((seat) => seat.userName)).toEqual(['a']);
    expect(findOnlineUser('b')?.status.type).toBe('none');
    expect(players[1].socket.received('gameUpdate')).toContainEqual({});
  });

  it('removes the table when its last player leaves', async () => {
    const { players } = await lobby(['a']);
    await create(players[0]);
    const game = games()[0];

    handleUserLeaveGame(players[0].socket, game, players[0].caller, {});
    await vi.advanceTimersByTimeAsync(0);

    expect(engineStore().games.size).toBe(0);
  });

  it('marks a player who leaves a running game as gone, and keeps their seat', async () => {
    const { players } = await lobby(['a', 'b', 'c', 'd', 'e']);
    await create(players[0], { minPlayersCount: 5, maxPlayersCount: 5 });
    const game = games()[0];
    for (const player of players.slice(1)) await sit(player, game.general.uid);
    vi.advanceTimersByTime(60_000);

    handleUserLeaveGame(players[2].socket, game, players[2].caller, {});

    const seat = game.publicPlayersState.find((candidate) => candidate.userName === 'c');
    expect(seat?.leftGame).toBe(true);
    expect(game.publicPlayersState).toHaveLength(5);
  });

  it('lets a player who left a running game come back to the table', async () => {
    const { players } = await lobby(['a', 'b', 'c', 'd', 'e']);
    await create(players[0], { minPlayersCount: 5, maxPlayersCount: 5 });
    const game = games()[0];
    for (const player of players.slice(1)) await sit(player, game.general.uid);
    vi.advanceTimersByTime(60_000);
    handleUserLeaveGame(players[2].socket, game, players[2].caller, {});

    sendGameInfo(players[2].socket, game.general.uid);

    const seat = game.publicPlayersState.find((candidate) => candidate.userName === 'c');
    expect(seat?.leftGame).toBe(false);
    expect(seat?.connected).toBe(true);
    expect(players[2].socket.got('updateSeatForUser')).toBe(true);
  });
});

describe('disconnecting', () => {
  it('takes the player off the online list and out of an unstarted table', async () => {
    const { players } = await lobby(['a', 'b']);
    await create(players[0]);
    const game = games()[0];
    await sit(players[1], game.general.uid);

    handleSocketDisconnect('b');

    expect(findOnlineUser('b')).toBeUndefined();
    expect(game.publicPlayersState.map((seat) => seat.userName)).toEqual(['a']);
  });

  it('keeps the seat of a player whose connection drops in a running game', async () => {
    const { players } = await lobby(['a', 'b', 'c', 'd', 'e']);
    await create(players[0], { minPlayersCount: 5, maxPlayersCount: 5 });
    const game = games()[0];
    for (const player of players.slice(1)) await sit(player, game.general.uid);
    vi.advanceTimersByTime(60_000);

    handleSocketDisconnect('d');

    const seat = game.publicPlayersState.find((candidate) => candidate.userName === 'd');
    expect(seat?.connected).toBe(false);
    expect(game.publicPlayersState).toHaveLength(5);
  });

  it('does nothing for an observer', async () => {
    await lobby(['a']);

    expect(() => handleSocketDisconnect(null)).not.toThrow();
    expect(findOnlineUser('a')).toBeDefined();
  });
});
