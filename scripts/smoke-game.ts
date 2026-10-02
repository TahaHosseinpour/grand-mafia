/**
 * End-to-end smoke test of the game server: five real Socket.IO clients play
 * one whole game against a running server and the real database, then the
 * script checks what was stored.
 *
 *   NODE_ENV=development PORT=3101 pnpm dev        # in one terminal
 *   pnpm smoke:game                                # in another (E2E_URL=http://localhost:3101)
 *
 * It signs in as users it creates itself (usernames starting with `e2e`) and
 * deletes them afterwards. Run it against a development or staging database,
 * never production. A development server (NODE_ENV=development) shortens the
 * game's animation delays to about a tenth of a second, so a game takes under
 * a minute.
 */
process.loadEnvFile('.env');

if (process.env.NODE_ENV === 'production') throw new Error('The smoke test creates and deletes users: not in production.');
import jwt from 'jsonwebtoken';
import { io, type Socket } from 'socket.io-client';

const BASE = process.env.E2E_URL ?? 'http://localhost:3101';
const { default: prisma } = await import('@/server/db');

const PREFIX = 'e2e';
const names = [1, 2, 3, 4, 5].map((n) => `${PREFIX}${n}`);

// Fresh users.
await prisma.game.deleteMany({ where: { name: 'e2e table' } });
await prisma.user.deleteMany({ where: { username: { startsWith: PREFIX } } });
const users = [];
for (const name of [...names, `${PREFIX}new`]) {
  users.push(
    await prisma.user.create({
      data: { username: name, usernameKey: name.toLowerCase(), passwordHash: 'x', verified: true, touLastAgreed: name.endsWith('new') ? null : '1.5' },
    })
  );
}

const connect = (user: { id: number; username: string }) => {
  const token = jwt.sign({ userId: user.id }, process.env.JWT_SECRET as string, { expiresIn: '1h' });
  const socket = io(BASE, { extraHeaders: { cookie: `auth-token=${token}` }, transports: ['websocket'] });
  return socket;
};

type Bot = { name: string; socket: Socket; log: string[]; events: Map<string, unknown[]> };
const bots: Bot[] = users.slice(0, 5).map((user) => {
  const socket = connect(user);
  const bot: Bot = { name: user.username, socket, log: [], events: new Map() };
  socket.onAny((event, ...args) => {
    const list = bot.events.get(event) ?? [];
    list.push(args[0]);
    bot.events.set(event, list);
  });
  return bot;
});
const newbie = connect(users[5]);
const newbieEvents: string[] = [];
newbie.onAny((event) => newbieEvents.push(event));

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
const fail = (message: string): never => {
  console.error('FAIL:', message);
  process.exit(1);
};
const check = (condition: unknown, message: string) => {
  if (!condition) fail(message);
  console.log('ok  -', message);
};

await sleep(1500);
for (const bot of bots) check(bot.events.has('gameList') && bot.events.has('userList') && bot.events.has('emoteList'), `${bot.name} received the opening lists`);
check(newbieEvents.includes('touChange'), 'a new player is shown the terms');

// Settings and general chat.
for (const bot of bots) bot.socket.emit('getUserGameSettings');
await sleep(500);
bots[0].socket.emit('updateGameSettings', { fontSize: 17 });
await sleep(500);
const settings = bots[0].events.get('gameSettings')?.slice(-1)[0] as { fontSize?: number } | undefined;
check(settings?.fontSize === 17, 'a settings change comes back from the server');
const row = await prisma.user.findUnique({ where: { username: bots[0].name } });
check((row?.gameSettings as { fontSize?: number })?.fontSize === 17, 'and is saved in PostgreSQL');

bots[1].socket.emit('addNewGeneralChat', { chat: 'سلام از e2e' });
await sleep(500);
check(JSON.stringify(bots[3].events.get('generalChats')?.slice(-1)[0]).includes('سلام از e2e'), 'general chat reaches the others');

// A table.
bots[0].socket.emit('addNewGame', { gameName: 'e2e table', minPlayersCount: 5, maxPlayersCount: 5 });
await sleep(800);
const listed = (bots[1].events.get('gameList')?.slice(-1)[0] ?? bots[1].events.get('newGameAdded')?.slice(-1)[0]) as { uid: string }[] | { uid: string };
const uid = Array.isArray(listed) ? listed.find((g) => (g as { name?: string }).name === 'e2e table')?.uid : listed?.uid;
check(uid, `the table is listed (${uid})`);

type Update = {
  general: { uid: string; electionCount: number };
  gameState: { phase?: string; presidentIndex: number; isCompleted: false | string; clickActionInfo?: [string, number[]]; isTracksFlipped?: boolean; isVetoEnabled?: boolean };
  publicPlayersState: { userName: string; governmentStatus?: string; isDead?: boolean }[];
  playersState?: { policyNotification?: boolean }[];
  cardFlingerState?: { notificationStatus?: string }[];
};

// Written from the socket callbacks, so it lives in an object TypeScript does not narrow.
const result = { winner: false as false | string };
const done = new Set<string>();
const rng = () => Math.random();
const pick = <T>(items: T[]) => items[Math.floor(rng() * items.length)];

for (const bot of bots) {
  bot.socket.on('gameUpdate', (update: Update) => {
    if (!update?.gameState) return;
    const { gameState, publicPlayersState, general } = update;
    if (gameState.isCompleted) {
      result.winner = gameState.isCompleted;
      return;
    }
    if (!gameState.isTracksFlipped) return;
    const me = publicPlayersState.findIndex((p) => p.userName === bot.name);
    const cards = update.cardFlingerState ?? [];
    const key = (what: string) => `${bot.name}:${general.electionCount}:${gameState.phase}:${what}`;
    const once = (what: string, run: () => void) => {
      if (done.has(key(what))) return;
      done.add(key(what));
      bot.log.push(key(what));
      run();
    };
    const emit = (event: string, payload: Record<string, unknown>) => bot.socket.emit(event, { uid: general.uid, ...payload });
    const click = gameState.clickActionInfo;
    const isMyClick = click?.[0] === bot.name;

    switch (gameState.phase) {
      case 'selectingChancellor':
        if (isMyClick) once('nominate', () => emit('presidentSelectedChancellor', { chancellorIndex: pick(click![1]) }));
        break;
      case 'voting':
        if (cards.length === 2 && cards[0].notificationStatus === 'notification') once('vote', () => emit('selectedVoting', { vote: rng() < 0.65 }));
        break;
      case 'presidentSelectingPolicy':
        if (cards.length === 3) once('discard', () => emit('selectedPresidentPolicy', { selection: Math.floor(rng() * 3) }));
        break;
      case 'chancellorSelectingPolicy':
        if (cards.length === 2) once('enact', () => emit('selectedChancellorPolicy', { selection: rng() < 0.5 ? 0 : 3 }));
        break;
      case 'chancellorVoteOnVeto':
        if (cards.length === 2) once('veto', () => emit('selectedChancellorVoteOnVeto', { vote: rng() < 0.5 }));
        break;
      case 'presidentVoteOnVeto':
        if (publicPlayersState[me]?.governmentStatus === 'isPresident') once('vetoAnswer', () => emit('selectedPresidentVoteOnVeto', { vote: rng() < 0.5 }));
        break;
      case 'presidentVoteOnBurn':
        if (publicPlayersState[me]?.governmentStatus === 'isPresident') once('burn', () => emit('selectedPresidentVoteOnBurn', { vote: rng() < 0.5 }));
        break;
      case 'selectPartyMembershipInvestigate':
        if (isMyClick) once('inv', () => emit('selectPartyMembershipInvestigate', { playerIndex: pick(click![1]) }));
        break;
      case 'specialElection':
        if (isMyClick) once('special', () => emit('selectedSpecialElection', { playerIndex: pick(click![1]) }));
        break;
      case 'execution':
        // A plain fascist president may not shoot Hitler; the server refuses, so try again with another seat.
        if (isMyClick) {
          const attempt = `exec${bot.log.length}`;
          once(attempt, () => emit('selectedPlayerToExecute', { playerIndex: pick(click![1]) }));
        }
        break;
      default:
        if (update.playersState?.[me]?.policyNotification) once('peek', () => bot.socket.emit('selectedPolicies', { uid: general.uid }));
    }
  });
}

for (const bot of bots.slice(1)) {
  bot.socket.emit('updateSeatedUser', { uid });
  await sleep(150);
  bot.socket.emit('getGameInfo', uid);
}
for (const bot of bots) {
  bot.socket.emit('getGameInfo', uid);
}

const started = Date.now();
while (!result.winner && Date.now() - started < 180_000) {
  await sleep(500);
  // A refused execution (a fascist may not shoot Hitler) is retried: clear the attempt keys while the phase persists.
  for (const key of [...done]) if (key.includes(':execution:exec')) done.delete(key);
}
check(result.winner, `the game finished over the wire in ${((Date.now() - started) / 1000).toFixed(1)} s (winner: ${result.winner})`);

await sleep(5000);
const stored = await prisma.game.findUnique({ where: { uid } });
check(stored?.winningTeam === result.winner, `the finished game is in PostgreSQL (winners: ${stored?.winningTeam})`);
const after = await prisma.user.findMany({ where: { username: { in: names } }, select: { username: true, wins: true, losses: true, eloOverall: true } });
check(after.every((u) => u.wins + u.losses === 1), 'every player has one game counted');
const eloSum = after.reduce((sum, u) => sum + u.eloOverall, 0);
check(Math.abs(eloSum - 5 * 1600) < 1e-6, `Elo is conserved (sum ${eloSum})`);
console.log(after.map((u) => `${u.username}: ${u.wins}W/${u.losses}L elo ${u.eloOverall.toFixed(1)}`).join('\n'));

for (const bot of bots) bot.socket.close();
newbie.close();
await prisma.game.deleteMany({ where: { uid } });
await prisma.user.deleteMany({ where: { username: { startsWith: PREFIX } } });
await prisma.$disconnect();
console.log('E2E OK');
process.exit(0);
