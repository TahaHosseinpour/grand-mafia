import { applyRankedResultForGameEnd, applyUnrankedXpForGameEnd, type PlayerRatingAfterGame } from '@/features/ranking';
import { T } from '@/lib/glossary';
import { log } from '@/server/logger';
import { line, typed } from './chat';
import { findOnlineUser, sendGameList, sendUserList } from './lists';
import { saveGame } from './persist';
import { makeReport, type ReportType } from './report';
import { getHub } from './store';
import { sendInProgressGameUpdate } from './updates';
import type { ChatPart, Game, GameChatLine, SeatedPlayer, Team } from './types';

const formatSignedDelta = (value: number | undefined): string => {
  const safe = Number(value) || 0;
  return `${safe >= 0 ? '+' : '-'}${Math.abs(safe).toFixed(1)}`;
};

const ROLE_ORDER = ['hitler', 'morgana', 'monarchist', 'fascist', 'merlin', 'percival', 'liberal'] as const;

/** Players listed Hitler first, then the fascist side, then the liberal side. */
function sortedForResults(players: SeatedPlayer[]): SeatedPlayer[] {
  const byName = (a: SeatedPlayer, b: SeatedPlayer) => (a.userName === b.userName ? 0 : a.userName > b.userName ? 1 : -1);
  return ROLE_ORDER.flatMap((role) => {
    const same = players.filter((player) => player.role.cardName === role);
    return role === 'fascist' || role === 'liberal' ? same.sort(byName) : same;
  });
}

const eloLine = (player: SeatedPlayer, label: string, active: number | undefined, secondary: number | undefined, offset: number): GameChatLine => ({
  gameChat: true,
  timestamp: new Date(Date.now() + offset),
  chat: [
    typed(player.role.cardName, player.userName),
    { text: ` ${label}: ` },
    typed('player', ` ${formatSignedDelta(active)}`),
    { text: ` (${formatSignedDelta(secondary)})` },
  ] as ChatPart[],
});

/** Does this game count for Elo? Not private, casual, custom, practice or unlisted games. */
const isRanked = (game: Game): boolean =>
  !game.general.private &&
  !game.general.casualGame &&
  !game.customGameSettings?.enabled &&
  !game.general.practiceGame &&
  !game.general.unlistedGame;

/** Mirrors a player's new numbers into the online list the lobby shows. */
function mirrorIntoOnlineList(rating: PlayerRatingAfterGame): void {
  const entry = findOnlineUser(rating.username);
  if (!entry) return;
  Object.assign(entry, {
    eloOverall: rating.eloOverall,
    eloSeason: rating.eloSeason,
    xpOverall: rating.xpOverall,
    xpSeason: rating.xpSeason,
    isRainbowOverall: rating.isRainbowOverall,
    isRainbowSeason: rating.isRainbowSeason,
    wins: rating.wins,
    losses: rating.losses,
    rainbowWins: rating.rainbowWins,
    rainbowLosses: rating.rainbowLosses,
    winsSeason: rating.winsSeason,
    lossesSeason: rating.lossesSeason,
    rainbowWinsSeason: rating.rainbowWinsSeason,
    rainbowLossesSeason: rating.rainbowLossesSeason,
  });
}

async function rankAndAnnounce(game: Game, winningTeam: Team, winners: string[]): Promise<void> {
  const seated = game.private.seatedPlayers;
  const ratings = await applyRankedResultForGameEnd({
    info: {
      playerCount: game.general.playerCount,
      rainbowGame: Boolean(game.general.rainbowgame),
      winningTeam,
      rebalance6p: game.general.rebalance6p,
      rebalance7p: game.general.rebalance7p,
      rebalance9p2f: game.general.rebalance9p2f,
    },
    gameUid: game.general.uid,
    winners,
    players: seated.map((player) => player.userName),
  });

  const byName = new Map(ratings.map((rating) => [rating.username, rating]));
  const ordered = sortedForResults(seated);

  // The record of the finished game shows overall numbers first.
  ordered.forEach((player, i) => {
    const change = byName.get(player.userName);
    game.private.replayGameChats.push(
      eloLine(player, 'Elo', change?.change, change?.changeSeason, i),
      eloLine(player, 'XP', change?.xpChange, change?.xpChangeSeason, i)
    );
  });

  for (const rating of ratings) {
    mirrorIntoOnlineList(rating);

    const seat = seated.find((player) => player.userName === rating.username);
    if (!seat || rating.disableElo) continue;

    // Each player sees their preferred (seasonal or overall) number first.
    ordered.forEach((player, i) => {
      const other = byName.get(player.userName);
      const showOverall = rating.disableSeasonal;
      seat.gameChats.push(
        eloLine(player, 'Elo', showOverall ? other?.change : other?.changeSeason, showOverall ? other?.changeSeason : other?.change, i),
        eloLine(player, 'XP', showOverall ? other?.xpChange : other?.xpChangeSeason, showOverall ? other?.xpChangeSeason : other?.xpChange, i)
      );
    });
  }

  sendUserList();
  sendInProgressGameUpdate(game);
}

/** Guesses by observers, announced under the result. */
function announceGuesses(game: Game): void {
  const now = Date.now();
  let order = 2;
  const guesses = Object.entries(game.guesses);
  const merlinGuesses = Object.entries(game.merlinGuesses);

  const push = (text: string) => game.chats.push({ gameChat: true, timestamp: now + order++, chat: [{ text }] });

  if (guesses.length || merlinGuesses.length) {
    game.chats.push({ gameChat: true, timestamp: now, chat: [{ text: 'حدس خط‌ها', type: 'player' }] });
  }

  if (guesses.length) {
    const seats = game.private.seatedPlayers;
    const hitlerSeat = seats.findIndex((player) => player.role.cardName === 'hitler') + 1;
    const fascistSeats = seats.map((player, i) => (player.role.team === 'fascist' ? i + 1 : 0)).filter(Boolean);
    const numFas = fascistSeats.length;
    const truth = { regs: fascistSeats, hit: hitlerSeat };

    const grouped: [string, (typeof guesses)[number][1]][][] = Array.from({ length: 5 }, () => []);
    const perfect: [string, (typeof guesses)[number][1]][] = [];
    const hitty: [string, (typeof guesses)[number][1]][] = [];

    for (const [user, guess] of guesses) {
      const same = guess.regs.filter((seat) => truth.regs.includes(seat)).length;
      const hitCorrect = guess.hit === truth.hit;
      if (same === numFas && hitCorrect) {
        perfect.push([user, guess]);
      } else {
        grouped[same]?.push([user, guess]);
        if (hitCorrect) hitty.push([user, guess]);
      }
    }

    const names = (list: [string, { toString(): string }][]) => list.map(([user, guess]) => `${user} (${guess.toString()})`).join('، ');

    if (perfect.length) push(`همه‌ی فاشیست‌ها و هیتلر درست — ${names(perfect)}`);

    for (let i = numFas; i >= 0; i--) {
      const prefix =
        i === numFas
          ? 'همه‌ی فاشیست‌ها درست — '
          : i === 3
            ? 'سه فاشیست درست — '
            : i === 2
              ? 'دو فاشیست درست — '
              : i === 1
                ? 'یک فاشیست درست — '
                : 'هیچ فاشیستی درست نبود :( — ';
      if (grouped[i]?.length) push(prefix + names(grouped[i]));
    }

    if (hitty.length) push(`هیتلر درست — ${names(hitty)}`);
  }

  if (merlinGuesses.length) {
    const merlinSeat = game.private.seatedPlayers.findIndex((player) => player.role.cardName === 'merlin') + 1;
    const bySeat = new Map<number, string[]>();
    for (const [user, seat] of merlinGuesses) bySeat.set(seat, [...(bySeat.get(seat) ?? []), user]);

    if (bySeat.has(merlinSeat)) push(`مرلین درست — ${bySeat.get(merlinSeat)?.join('، ')}`);

    const wrong = [...bySeat.keys()].filter((seat) => seat !== merlinSeat).sort((a, b) => a - b);
    if (wrong.length) push(`مرلین نادرست — ${wrong.map((seat) => `${bySeat.get(seat)?.join('، ')} (${seat})`).join('، ')}`);
  }

  sendInProgressGameUpdate(game);
}

/**
 * The game is decided: marks the winners, announces the result, records the
 * game, updates Elo/XP and announces the observers' guesses.
 */
export function completeGame(game: Game, winningTeamName: Team): void {
  for (const report of game.unsentReports ?? []) {
    const { type, ...data } = report;
    makeReport(data as never, game, type === 'modchat' ? 'modchatdelayed' : ('reportdelayed' as ReportType));
  }
  game.unsentReports = [];

  for (const player of game.publicPlayersState) {
    for (const socket of getHub().allSockets().filter((s) => s.username === player.userName).slice(0, 1)) {
      socket.emit('removeClaim');
    }
  }

  if (game.general.timedMode && game.private.timerId) {
    clearTimeout(game.private.timerId);
    game.private.timerId = null;
    game.gameState.timedModeEnabled = false;
  }

  if (game.general.isRecorded) {
    log().warn({ uid: game.general.uid }, 'a game attempted to be recorded twice');
    return;
  }

  const { seatedPlayers } = game.private;
  const { publicPlayersState } = game;
  const winningPrivatePlayers = seatedPlayers.filter((player) => player.role.team === winningTeamName);
  const winners = winningPrivatePlayers.map((player) => player.userName);

  const resultLine = line(typed(winningTeamName, winningTeamName === 'fascist' ? T.fascists : T.liberals), ' بازی را می‌برند.');
  const remaining: GameChatLine = {
    isRemainingPolicies: true,
    timestamp: new Date(),
    chat: [
      { text: 'قوانین باقی‌مانده: ' },
      { policies: game.private.policies.map((policy) => (policy === 'liberal' ? 'b' : 'r')) },
      { text: '.' },
    ],
  };

  for (const player of winningPrivatePlayers) {
    const publicPlayer = publicPlayersState.find((play) => play.userName === player.userName);
    if (publicPlayer) {
      publicPlayer.notificationStatus = 'success';
      publicPlayer.isConfetti = true;
    }
    player.wonGame = true;
  }

  setTimeout(() => {
    for (const player of winningPrivatePlayers) {
      const publicPlayer = publicPlayersState.find((play) => play.userName === player.userName);
      if (publicPlayer) publicPlayer.isConfetti = false;
    }
    sendInProgressGameUpdate(game, true);
  }, 15000);

  game.general.status = winningTeamName === 'fascist' ? `${T.fascists} بازی را می‌برند.` : `${T.liberals} بازی را می‌برند.`;
  game.gameState.isCompleted = winningTeamName;
  game.gameState.timeCompleted = Date.now();
  sendGameList();

  publicPlayersState.forEach((publicPlayer, index) => {
    publicPlayer.nameStatus = seatedPlayers[index].role.cardName;
  });

  for (const player of seatedPlayers) player.gameChats.push(resultLine, remaining);
  game.private.unSeatedGameChats.push(resultLine, remaining);

  sendInProgressGameUpdate(game);

  void saveGame(game);
  game.general.isRecorded = true;

  const everyone = seatedPlayers.map((player) => player.userName);
  const afterRatings = isRanked(game)
    ? rankAndAnnounce(game, winningTeamName, winners)
    : game.general.playerChats === 'disabled' || game.general.practiceGame
      ? applyUnrankedXpForGameEnd(everyone, winners)
      : Promise.resolve();

  // Ratings are written in the background; the guesses are announced at once.
  afterRatings.catch((error: unknown) =>
    log().error({ err: error, uid: game.general.uid }, 'updating ratings at the end of a game failed')
  );
  announceGuesses(game);
}
