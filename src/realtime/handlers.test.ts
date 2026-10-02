import { beforeEach, describe, expect, it, vi } from 'vitest';
import { engineStore, findOnlineUser } from '@/features/games/realtime';
import { asGameSocket, actorOf, resetRealtime, type FakeIo, type FakeIoSocket } from '@/test/fake-io';
import { world } from '@/test/world';
import { onConnection } from './connection';

/**
 * The wire: events sent the way a browser sends them, through the real
 * handlers and the real engine.
 */

let io: FakeIo;

async function browser(username: string | null, accountOverrides: Parameters<typeof world.addAccount>[1] = {}): Promise<FakeIoSocket> {
  if (username && !world.accounts.has(username)) world.addAccount(username, accountOverrides);
  const socket = io.connect(username ? actorOf(username, accountOverrides.staffRole ?? null) : null);
  onConnection(asGameSocket(socket));
  // What the client does as soon as it connects: ask for the lists and for its own settings.
  await socket.receive('requestUserList');
  if (username) await socket.receive('getUserGameSettings');
  return socket;
}

const games = () => [...engineStore().games.values()];

beforeEach(() => {
  vi.useFakeTimers();
  io = resetRealtime();
});

describe('connecting', () => {
  it('sends a player the opening lists', async () => {
    const socket = await browser('sara');

    for (const event of ['version', 'generalChats', 'gameList', 'userList', 'emoteList', 'removeAllPopups']) {
      expect(socket.got(event), event).toBe(true);
    }
  });

  it('sends an observer the lists too, but nothing about an account', async () => {
    const socket = await browser(null);

    expect(socket.got('gameList')).toBe(true);
    expect(socket.got('removeAllPopups')).toBe(false);
  });

  it('shows a player with new terms the terms before anything else', async () => {
    const socket = await browser('sara', { touLastAgreed: null });

    expect(socket.got('touChange')).toBe(true);
    expect(socket.got('removeAllPopups')).toBe(false);
  });

  it('answers an event sent the moment it connects', async () => {
    world.addAccount('sara');
    const socket = io.connect(actorOf('sara'));
    onConnection(asGameSocket(socket));

    await socket.receive('getUserGameSettings');

    expect(socket.got('gameSettings')).toBe(true);
  });

  it('turns away a banned player and registers nothing for them', async () => {
    world.addAccount('troll', { isBanned: true });
    const socket = io.connect(actorOf('troll'));
    onConnection(asGameSocket(socket));

    await socket.receive('getUserGameSettings');

    expect(socket.got('manualDisconnection')).toBe(true);
    expect(socket.connected).toBe(false);
    expect(socket.got('gameSettings')).toBe(false);
  });
});

describe('who may send what', () => {
  it('lets an observer read lists but not act', async () => {
    const observer = await browser(null);
    observer.clear();

    await observer.receive('getGameList');
    expect(observer.got('gameList')).toBe(true);

    await observer.receive('addNewGame', { gameName: 'x' });
    await observer.receive('addNewGeneralChat', { chat: 'hi' });
    await observer.receive('updateGameSettings', { fontSize: 20 });
    await observer.receive('updateBio', 'bio');

    expect(games()).toHaveLength(0);
    expect(engineStore().generalChats.list).toHaveLength(0);
  });

  it('refuses game actions to a player with terms or a warning waiting, until they act', async () => {
    const sara = await browser('sara', { touLastAgreed: null });

    await sara.receive('addNewGame', { gameName: 'x' });
    await sara.receive('addNewGeneralChat', { chat: 'hi' });
    expect(games()).toHaveLength(0);
    expect(engineStore().generalChats.list).toHaveLength(0);

    await sara.receive('confirmTOU');
    expect(world.account('sara').touLastAgreed).toBe('1.5');
    expect(sara.got('removeAllPopups')).toBe(true);

    await sara.receive('addNewGame', { gameName: 'x' });
    expect(games()).toHaveLength(1);
  });

  it('shows warnings one by one and releases the player after the last', async () => {
    world.warnings.set('sara', [{ id: 1, text: 'be nice', time: new Date().toISOString(), acknowledged: false }]);
    const sara = await browser('sara');
    expect(sara.lastReceived('warningPopup')).toMatchObject({ text: 'be nice' });

    await sara.receive('addNewGame', { gameName: 'x' });
    expect(games()).toHaveLength(0);

    await sara.receive('acknowledgeWarning');
    await sara.receive('addNewGame', { gameName: 'x' });
    expect(games()).toHaveLength(1);
  });

  it('ignores «confirmTOU» from a player who has nothing to confirm', async () => {
    const sara = await browser('sara', { touLastAgreed: '1.5' });

    await sara.receive('confirmTOU');

    expect(world.account('sara').touLastAgreed).toBe('1.5');
  });

  it('takes the sender\'s name from the connection, never from the payload', async () => {
    const sara = await browser('sara');
    await browser('omid');

    await sara.receive('addNewGeneralChat', { chat: 'hi', userName: 'omid', username: 'omid' });
    await sara.receive('addNewGame', { gameName: 'x', userName: 'omid', creatorName: 'omid' });

    expect(engineStore().generalChats.list[0].userName).toBe('sara');
    expect(games()[0].private.gameCreatorName).toBe('sara');
    expect(findOnlineUser('omid')?.status.type).toBe('none');
  });
});

describe('payloads', () => {
  it('answers an unknown table with an empty update, and does not run the handler', async () => {
    const sara = await browser('sara');
    sara.clear();

    await sara.receive('selectedVoting', { uid: 'NoSuchTable', vote: true });
    await sara.receive('addNewGameChat', { uid: 'constructor', chat: 'hi' });

    expect(sara.received('gameUpdate')).toEqual([{}, {}]);
  });

  it('ignores events with a payload of the wrong shape', async () => {
    const sara = await browser('sara');
    await sara.receive('addNewGame', { gameName: 'x' });
    const { uid } = games()[0].general;

    for (const payload of [null, 5, 'x', [], { uid }, { uid, chancellorIndex: 'one' }, { uid, chancellorIndex: -1 }, { uid, chancellorIndex: 1.5 }]) {
      await sara.receive('presidentSelectedChancellor', payload);
    }

    expect(games()[0].gameState.phase).not.toBe('voting');
  });

  it('drops events named like Socket.IO\'s own, so a client cannot fake the lifecycle', async () => {
    const sara = await browser('sara');
    expect(findOnlineUser('sara')).toBeDefined();

    for (const event of ['disconnect', 'disconnecting', 'error', 'connect', 'newListener', 'removeListener']) {
      await sara.receive(event, 'boom');
    }

    expect(findOnlineUser('sara')).toBeDefined();
  });

  it('stops answering a client that floods it, and recovers afterwards', async () => {
    const sara = await browser('sara');
    sara.clear();

    for (let i = 0; i < 150; i++) await sara.receive('getGameList');
    expect(sara.received('gameList').length).toBeLessThan(150);
    expect(sara.received('gameList').length).toBeLessThanOrEqual(100);

    vi.advanceTimersByTime(6000);
    sara.clear();
    await sara.receive('getGameList');
    expect(sara.got('gameList')).toBe(true);
  });
});

describe('playing over the wire', () => {
  async function table() {
    const names = ['a', 'b', 'c', 'd', 'e'];
    const sockets: FakeIoSocket[] = [];
    for (const name of names) sockets.push(await browser(name));

    await sockets[0].receive('addNewGame', { gameName: 'table', minPlayersCount: 5, maxPlayersCount: 5 });
    const game = games()[0];
    for (const socket of sockets.slice(1)) {
      await socket.receive('updateSeatedUser', { uid: game.general.uid });
      await socket.receive('getGameInfo', game.general.uid);
    }
    vi.advanceTimersByTime(60_000);
    return { sockets, game };
  }

  it('lets the president nominate and everyone vote, and refuses anyone else', async () => {
    const { sockets, game } = await table();
    const { uid } = game.general;
    const presidentName = game.private.seatedPlayers[game.gameState.presidentIndex].userName;
    const president = sockets.find((socket) => socket.data.actor?.username === presidentName)!;
    const other = sockets.find((socket) => socket !== president)!;
    const candidate = game.private.seatedPlayers.findIndex((seat) => seat.userName !== presidentName);

    await other.receive('presidentSelectedChancellor', { uid, chancellorIndex: candidate });
    expect(game.gameState.phase).toBe('selectingChancellor');

    await president.receive('presidentSelectedChancellor', { uid, chancellorIndex: candidate });
    expect(game.gameState.phase).toBe('voting');

    vi.advanceTimersByTime(3000);
    for (const socket of sockets) await socket.receive('selectedVoting', { uid, vote: true });
    expect(game.private.seatedPlayers.every((seat) => seat.voteStatus?.hasVoted)).toBe(true);

    vi.advanceTimersByTime(20_000);
    expect(game.gameState.phase).toBe('presidentSelectingPolicy');
  });

  it('ignores a vote from someone not at the table', async () => {
    const { game } = await table();
    const outsider = await browser('mallory');
    const { uid } = game.general;

    vi.advanceTimersByTime(1000);
    await outsider.receive('selectedVoting', { uid, vote: true });
    await outsider.receive('presidentSelectedChancellor', { uid, chancellorIndex: 1 });

    expect(game.private.seatedPlayers.some((seat) => seat.voteStatus?.hasVoted)).toBe(false);
    expect(game.gameState.phase).toBe('selectingChancellor');
  });

  it('sends each player their own view of the table', async () => {
    const { sockets, game } = await table();

    for (const socket of sockets) {
      const update = socket.lastReceived('gameUpdate') as { playersState?: { nameStatus?: string }[] };
      const mine = game.private.seatedPlayers.find((seat) => seat.userName === socket.data.actor?.username)!;
      const seat = game.private.seatedPlayers.indexOf(mine);
      expect(update.playersState?.[seat]?.nameStatus).toBe(mine.role.cardName);

      // …and no other seat names a role the player is not entitled to know.
      const learned = (update.playersState ?? []).filter((_, i) => i !== seat).map((state) => state.nameStatus).filter(Boolean);
      const allowed = mine.role.team === 'liberal' ? [] : ['fascist', 'hitler'];
      for (const name of learned) expect(allowed).toContain(name);
    }
  });

  it('keeps a player online while another tab of theirs is open, and removes them when the last one closes', async () => {
    const first = await browser('sara');
    const second = await browser('sara');

    // The second connection closes the first.
    expect(first.connected).toBe(false);
    expect(first.got('manualDisconnection')).toBe(true);
    expect(findOnlineUser('sara')).toBeDefined();

    second.disconnect();
    expect(findOnlineUser('sara')).toBeUndefined();
  });

  it('puts a player whose connection dropped back at their running game when they reopen it', async () => {
    const { sockets, game } = await table();
    sockets[2].disconnect();
    const dropped = game.publicPlayersState.find((seat) => seat.userName === 'c');
    expect(dropped?.connected).toBe(false);
    expect(dropped?.leftGame).toBe(true);

    const again = await browser('c');
    await again.receive('getGameInfo', game.general.uid);

    expect(dropped?.connected).toBe(true);
    expect(dropped?.leftGame).toBe(false);
    expect(again.got('updateSeatForUser')).toBe(true);
    expect(again.rooms.has(game.general.uid)).toBe(true);
  });

  it('lets the creator edit a private table\'s whitelist, but nobody outside the table', async () => {
    const creator = await browser('a');
    await creator.receive('addNewGame', { gameName: 'private one', privatePassword: 'pw' });
    const game = games()[0];
    const outsider = await browser('mallory');

    await outsider.receive('updateGameWhitelist', { uid: game.general.uid, password: 'pw', whitelistPlayers: ['mallory'] });
    expect(game.general.whitelistedPlayers).toEqual([]);

    await creator.receive('updateGameWhitelist', { uid: game.general.uid, whitelistPlayers: ['omid'] });
    expect(game.general.whitelistedPlayers).toEqual(['omid']);
  });
});
