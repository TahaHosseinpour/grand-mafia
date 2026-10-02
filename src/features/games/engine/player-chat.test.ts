import { beforeEach, describe, expect, it, vi } from 'vitest';
import { resetEngine, type FakeHub, type FakeSocket } from '@/test/fake-hub';
import { world } from '@/test/world';
import { handleAddNewGame } from './create-game';
import { handleSeatRequest } from './join-game';
import { findOnlineUser } from './lists';
import { handleAddNewGameChat, handleNewGeneralChat } from './player-chat';
import { sendUserGameSettings } from './presence';
import { sendGameInfo } from './requests';
import { engineStore } from './store';
import type { Game } from './types';

type Player = { name: string; socket: FakeSocket; caller: { username: string } };

async function connectAll(names: string[], accounts: Record<string, Parameters<typeof world.addAccount>[1]> = {}): Promise<{ hub: FakeHub; players: Player[] }> {
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

const say = (player: Player, chat: unknown) => handleNewGeneralChat(player.socket, player.caller, { chat });
const lobbyChat = () => engineStore().generalChats.list;

describe('the lobby chat', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  it('posts a message to everyone online', async () => {
    const { players } = await connectAll(['sara', 'omid']);

    await say(players[0], '  سلام به همه  ');

    expect(lobbyChat()).toHaveLength(1);
    expect(lobbyChat()[0]).toMatchObject({ chat: 'سلام به همه', userName: 'sara', staffRole: '' });
    expect(players[1].socket.got('generalChats')).toBe(true);
  });

  it('ignores empty, too long and markup-only messages, and payloads that are not text', async () => {
    const { players } = await connectAll(['sara']);

    for (const chat of ['', '   ', 'x'.repeat(301), '**', '~~~~', 5, null, { a: 1 }]) {
      await say(players[0], chat);
      vi.advanceTimersByTime(5000);
    }

    expect(lobbyChat()).toHaveLength(0);
  });

  it('drops a repeated message sent within three seconds, and a new one within half a second', async () => {
    const { players } = await connectAll(['sara']);

    await say(players[0], 'سلام');
    await say(players[0], 'سلام');
    await say(players[0], 'چطورید؟');
    expect(lobbyChat()).toHaveLength(1);

    vi.advanceTimersByTime(600);
    await say(players[0], 'چطورید؟');
    expect(lobbyChat()).toHaveLength(2);

    vi.advanceTimersByTime(2000);
    await say(players[0], 'چطورید؟');
    expect(lobbyChat()).toHaveLength(2);

    vi.advanceTimersByTime(1500);
    await say(players[0], 'چطورید؟');
    expect(lobbyChat()).toHaveLength(3);
  });

  it('keeps only the last 99 messages', async () => {
    const { players } = await connectAll(['sara']);

    for (let i = 0; i < 120; i++) {
      await say(players[0], `پیام ${i}`);
      vi.advanceTimersByTime(4000);
    }

    expect(lobbyChat()).toHaveLength(99);
    expect(lobbyChat()[98].chat).toBe('پیام 119');
  });

  it('is silent for a player with a private profile', async () => {
    const { players } = await connectAll(['sara'], { sara: { gameSettings: { isPrivate: true } } });

    await say(players[0], 'hi');

    expect(lobbyChat()).toHaveLength(0);
  });

  it('shows a moderator\'s role beside the message, or «ناشناس» when they are incognito', async () => {
    const { players } = await connectAll(['modi', 'hidden'], {
      modi: { staffRole: 'moderator' },
      hidden: { staffRole: 'admin', gameSettings: { staffIncognito: true } },
    });

    await say(players[0], 'سلام');
    await say(players[1], 'سلام از ناشناس');

    expect(lobbyChat()[0]).toMatchObject({ userName: 'modi', staffRole: 'moderator' });
    expect(lobbyChat()[1]).toMatchObject({ userName: 'ناشناس', hiddenUsername: 'hidden', staffRole: 'moderator' });
  });

  it('turns «@mod …» into a report for the moderators, once every three minutes, and does not post it', async () => {
    const { players } = await connectAll(['sara']);

    await say(players[0], '@mod یک نفر فحش می‌دهد');
    expect(world.reports).toHaveLength(1);
    expect(world.reports[0]).toMatchObject({ player: 'sara' });
    expect(lobbyChat()).toHaveLength(0);

    vi.advanceTimersByTime(60_000);
    await say(players[0], '@mod دوباره');
    expect(world.reports).toHaveLength(1);
    expect(players[0].socket.got('sendAlert')).toBe(true);

    vi.advanceTimersByTime(121_000);
    await say(players[0], '@mod دوباره');
    expect(world.reports).toHaveLength(2);
  });

  it('lets only players with some experience talk when the site is live', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    const { players } = await connectAll(['newbie', 'veteran'], { veteran: { xpOverall: 20 } });

    await say(players[0], 'hello?');
    await say(players[1], 'hello!');

    expect(lobbyChat().map((entry) => entry.userName)).toEqual(['veteran']);
    vi.unstubAllEnvs();
  });

  it('ignores someone who is not on the online list', async () => {
    const { hub } = await connectAll([]);
    const ghost = hub.connect('ghost');

    await handleNewGeneralChat(ghost, { username: 'ghost' }, { chat: 'boo' });

    expect(lobbyChat()).toHaveLength(0);
  });
});

/* ------------------------------------------------------------------ *
 * A table's chat
 * ------------------------------------------------------------------ */

async function tableOf(names: string[], options: Record<string, unknown> = {}, accounts: Record<string, Parameters<typeof world.addAccount>[1]> = {}) {
  const { hub, players } = await connectAll(names, accounts);
  await handleAddNewGame(players[0].socket, players[0].caller, { gameName: 'table', minPlayersCount: 5, maxPlayersCount: 5, ...options });
  const game = [...engineStore().games.values()][0] as Game;
  for (const player of players.slice(1)) {
    await handleSeatRequest(player.socket, player.caller, { uid: game.general.uid });
    sendGameInfo(player.socket, game.general.uid);
  }
  return { hub, players, game };
}

const tell = (player: Player, game: Game, chat: string) => handleAddNewGameChat(player.socket, player.caller, { chat, uid: game.general.uid }, game);
const written = (game: Game) => game.chats.filter((entry) => 'userName' in entry && entry.userName).map((entry) => (entry as { chat: string }).chat);

describe('a table\'s chat', () => {
  it('shows a seated player\'s message to the table', async () => {
    const { players, game } = await tableOf(['a', 'b']);

    await tell(players[1], game, 'سلام');

    expect(written(game)).toEqual(['سلام']);
  });

  it('drops a repeat within a second and a half', async () => {
    const { players, game } = await tableOf(['a', 'b']);

    await tell(players[1], game, 'hi');
    await tell(players[1], game, 'hi');
    expect(written(game)).toEqual(['hi']);

    vi.advanceTimersByTime(1600);
    await tell(players[1], game, 'hi');
    expect(written(game)).toEqual(['hi', 'hi']);
  });

  it('keeps observers out of a private table unless the creator whitelisted them', async () => {
    const { hub, players, game } = await tableOf(['a', 'b'], { privatePassword: 'pw' });
    world.addAccount('watcher', { xpOverall: 50 });
    const watcher = hub.connect('watcher');
    await sendUserGameSettings(watcher);
    const observer: Player = { name: 'watcher', socket: watcher, caller: { username: 'watcher' } };

    await tell(observer, game, 'hello');
    expect(written(game)).toEqual([]);

    game.general.whitelistedPlayers.push('watcher');
    await tell(observer, game, 'hello');
    expect(written(game)).toEqual(['hello']);
    expect(players).toHaveLength(2);
  });

  it('keeps observers without experience silent', async () => {
    const { hub, game } = await tableOf(['a']);
    world.addAccount('rookie');
    const socket = hub.connect('rookie');
    await sendUserGameSettings(socket);

    await tell({ name: 'rookie', socket, caller: { username: 'rookie' } }, game, 'hi');

    expect(written(game)).toEqual([]);
  });

  it('turns a slash command into a private reply, not a message', async () => {
    const { players, game } = await tableOf(['a', 'b']);

    await tell(players[1], game, '/unknowncommand');

    expect(written(game)).toEqual([]);
  });

  it('refuses a player who has been removed from the lobby list', async () => {
    const { players, game } = await tableOf(['a', 'b']);
    engineStore().userList.splice(engineStore().userList.findIndex((user) => user.userName === 'b'), 1);
    expect(findOnlineUser('b')).toBeUndefined();

    await tell(players[1], game, 'hi');

    expect(written(game)).toEqual([]);
  });

  it('refuses messages in a game that has chat turned off for players, once it has started', async () => {
    const { players, game } = await tableOf(['a', 'b', 'c', 'd', 'e'], { playerChats: 'disabled' });
    vi.advanceTimersByTime(60_000);
    expect(game.gameState.isStarted).toBe(true);

    await tell(players[1], game, 'hi');

    expect(written(game)).toEqual([]);
  });

  it('lets only emotes and digits through in an emote-only game', async () => {
    const { players, game } = await tableOf(['a', 'b', 'c', 'd', 'e'], { playerChats: 'emotes', gameType: 'casual' });
    vi.advanceTimersByTime(60_000);

    await tell(players[1], game, 'hello there');
    expect(written(game)).toEqual([]);

    vi.advanceTimersByTime(2000);
    await tell(players[1], game, 'I vote 3');
    expect(written(game)).toEqual(['3']);
  });

  it('does not allow emote-only chat in a ranked game: it is ordinary chat there', async () => {
    const { game } = await tableOf(['a', 'b', 'c', 'd', 'e'], { playerChats: 'emotes' });

    expect(game.general.playerChats).toBe('enabled');
  });
});
