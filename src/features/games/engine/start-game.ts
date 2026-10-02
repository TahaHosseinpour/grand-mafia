import { getEloForGameStart } from '@/features/users';
import { formatNumber } from '@/lib/datetime';
import { roleLabel, T } from '@/lib/glossary';
import { line, seatTag, typed, type Part } from './chat';
import { settingsOf, shufflePolicies, startElection } from './common';
import { getHub } from './store';
import { GameSummary } from './summary';
import { range, shuffle } from './shuffle';
import { sendInProgressGameUpdate, sendInProgressModChatUpdate } from './updates';
import type { Game, Role, SeatedPlayer, SeatView } from './types';

const isDevelopment = () => process.env.NODE_ENV === 'development';

/** «علی {2}، رضا {5} و سارا {7}» — mentions joined the Persian way. */
function seatList(game: Game, seats: number[]): Part[] {
  const parts: Part[] = [];
  seats.forEach((seat, i) => {
    if (i > 0) parts.push(i === seats.length - 1 ? ' و ' : '، ');
    parts.push(seatTag(game, seat));
  });
  return parts;
}

/** The standard options for a game that has none of its own. */
function applyStandardSettings(game: Game): void {
  const settings = game.customGameSettings;
  game.general.type = Math.floor((game.publicPlayersState.length - 5) / 2);
  if (settings.enabled) return;

  settings.hitlerZone = 3;
  settings.vetoZone = 5;
  settings.trackState = { lib: 0, fas: 0 };
  settings.deckState = { lib: 6, fas: 11 };

  const size = game.publicPlayersState.length;
  if (game.general.type === 0) {
    // 5–6 players
    settings.fascistCount = 1;
    settings.hitKnowsFas = true;
    settings.powers = [null, null, 'deckpeek', 'bullet', 'bullet'];
    if (game.general.rebalance6p && size === 6) settings.trackState.fas = 1;
  } else if (game.general.type === 1) {
    // 7–8 players
    settings.fascistCount = 2;
    settings.hitKnowsFas = false;
    settings.powers = [null, 'investigate', 'election', 'bullet', 'bullet'];
    if (game.general.rebalance7p && size === 7) settings.deckState.fas = 10;
  } else {
    // 9–10 players
    settings.fascistCount = 3;
    settings.hitKnowsFas = false;
    settings.powers = ['investigate', 'investigate', 'election', 'bullet', 'bullet'];
    if (game.general.rebalance9p2f && size === 9) settings.deckState.fas = 10;
  }
}

/** The deck of role cards for this game's options, one per seat, unshuffled across seats. */
function buildRoles(game: Game): Role[] {
  const settings = settingsOf(game);
  const seats = game.publicPlayersState.length;
  const { avalonSH, monarchistSH } = game.general;

  const liberals = shuffle(
    // Custom games can have up to 8 liberals but there are only 6 pictures; two repeat.
    range(0, 8).map((el): Role => {
      if (avalonSH?.withPercival) {
        return { cardName: el === 1 ? 'percival' : el === 0 ? 'merlin' : 'liberal', icon: el <= 1 ? undefined : (el - 2) % 6, team: 'liberal' };
      }
      if (avalonSH) return { cardName: el === 0 ? 'merlin' : 'liberal', icon: el === 0 ? undefined : (el - 1) % 6, team: 'liberal' };
      return { cardName: 'liberal', icon: el % 6, team: 'liberal' };
    })
  ).slice(0, seats - settings.fascistCount - 1);

  const fascists = shuffle(
    range(18, 21).map((el): Role => {
      if (avalonSH?.withPercival && monarchistSH) {
        if (el % 3 === 0) return { cardName: 'morgana', icon: el, team: 'fascist' };
        if (el % 3 === 1) return { cardName: 'monarchist', icon: undefined, team: 'fascist' };
        return { cardName: 'fascist', icon: el, team: 'fascist' };
      }
      if (avalonSH?.withPercival) return { cardName: el % 3 === 0 ? 'morgana' : 'fascist', icon: el, team: 'fascist' };
      if (monarchistSH) {
        if (el % 3 === 0) return { cardName: 'monarchist', icon: undefined, team: 'fascist' };
        return { cardName: 'fascist', icon: el, team: 'fascist' };
      }
      return { cardName: 'fascist', icon: el, team: 'fascist' };
    })
  ).slice(0, settings.fascistCount);

  return [{ cardName: 'hitler', icon: 6, team: 'fascist' }, ...liberals, ...fascists];
}

/** Gives every seat a role and its (empty) private view of the table. */
function dealRoles(game: Game, roles: Role[]): void {
  const dealt = [...roles];
  game.private.seatedPlayers.forEach((player, i) => {
    const index = Math.floor(Math.random() * dealt.length);
    player.role = dealt[index];
    dealt.splice(index, 1);

    player.playersState = range(0, game.publicPlayersState.length).map(
      (seat): SeatView => ({ notificationStatus: '', nameStatus: '', cardStatus: i === seat ? { cardBack: player.role } : {} })
    );

    if (game.general.avalonSH?.withPercival) {
      player.gameChats.push(
        line('این بازی ', typed('merlin', T.merlin), '، ', typed('percival', T.percival), ' و ', typed('morgana', T.morgana), ' دارد.')
      );
    } else if (game.general.avalonSH) {
      player.gameChats.push(line('این بازی ', typed('merlin', T.merlin), ' دارد.'));
    }
    if (game.general.monarchistSH) {
      player.gameChats.push(line('این بازی ', typed('monarchist', T.monarchist), ' دارد.'));
    }

    if (!game.general.disableGamechat) {
      player.gameChats.push({
        ...line(
          'بازی آغاز می‌شود و شما نقش ',
          typed(player.role.cardName, roleLabel(player.role.cardName)),
          ' را می‌گیرید و روی صندلی ',
          typed('player', `#${i + 1}`),
          ' می‌نشینید.'
        ),
        timestamp: Date.now() + 1,
      });
    } else {
      player.gameChats.push(line('بازی آغاز می‌شود.'));
    }

    const modLine = line(
      typed('player', `${player.userName} {${i + 1}}`),
      ' نقش ',
      typed(player.role.cardName, roleLabel(player.role.cardName)),
      ' را می‌گیرد.'
    );
    game.private.hiddenInfoChat.push(modLine);
    sendInProgressModChatUpdate(game, modLine);
  });
}

/**
 * After the cards are dealt, each player is told what their role lets them
 * see: fascists see each other, Hitler sees fascists in small games, Merlin
 * sees the fascists, Percival sees Merlin and Morgana.
 */
function revealKnowledge(game: Game): void {
  const { seatedPlayers } = game.private;
  const settings = settingsOf(game);
  const silent = Boolean(game.general.disableGamechat);
  const seatOf = (player: SeatedPlayer) => seatedPlayers.indexOf(player);
  const hitlerPlayer = seatedPlayers.find((player) => player.role.cardName === 'hitler') as SeatedPlayer;

  seatedPlayers.forEach((player, i) => {
    const { cardName } = player.role;
    player.playersState[i].nameStatus = cardName;

    const markFascist = (other: SeatedPlayer, notify = true) => {
      player.playersState[seatOf(other)].nameStatus = 'fascist';
      if (notify) player.playersState[seatOf(other)].notificationStatus = 'fascist';
    };

    if (cardName === 'fascist' || cardName === 'morgana' || cardName === 'monarchist') {
      const otherFascists = seatedPlayers.filter(
        (play) => play.role.team === 'fascist' && play.role.cardName !== 'hitler' && play.userName !== player.userName
      );

      if (settings.fascistCount === 2) {
        const other = otherFascists[0];
        if (!other) return;
        if (!silent) {
          player.gameChats.push(line('می‌بینید که ', typed('fascist', `${T.fascist} دیگرِ`), ' این بازی ', seatTag(game, seatOf(other)), ' است.'));
        }
        markFascist(other);
      } else if (settings.fascistCount === 3) {
        if (!silent) {
          player.gameChats.push(
            line('می‌بینید که ', typed('fascist', `${T.fascists} دیگرِ`), ' این بازی ', ...seatList(game, otherFascists.map(seatOf)), ' هستند.')
          );
        }
        for (const other of otherFascists) markFascist(other);
      }

      if (cardName !== 'monarchist') {
        const chat = line(
          'می‌بینید که ',
          typed('hitler', T.hitler),
          ' در این بازی ',
          seatTag(game, seatOf(hitlerPlayer)),
          ' است. ',
          settings.hitKnowsFas ? 'او هم می‌بیند که شما ' : 'او نمی‌داند که شما ',
          typed('fascist', T.fascist),
          ' هستید.'
        );
        if (!silent) player.gameChats.push(chat);
        player.playersState[seatOf(hitlerPlayer)].notificationStatus = 'hitler';
        player.playersState[seatOf(hitlerPlayer)].nameStatus = 'hitler';
      }
    } else if (cardName === 'hitler') {
      if (settings.hitKnowsFas) {
        if (settings.fascistCount === 1) {
          const other = seatedPlayers.find((play) => play.role.team === 'fascist' && play.role.cardName !== 'hitler') as SeatedPlayer;
          if (!silent) {
            player.gameChats.push(
              line(
                'می‌بینید که ',
                typed('fascist', `${T.fascist} دیگرِ`),
                ' این بازی ',
                seatTag(game, seatOf(other)),
                game.general.monarchistSH ? ' است. او نمی‌داند شما کی هستید.' : ' است. او می‌داند شما کی هستید.'
              )
            );
          }
          markFascist(other);
        } else {
          const others = seatedPlayers.filter((play) => play.role.team === 'fascist' && play.userName !== player.userName);
          if (!silent) {
            player.gameChats.push(line('می‌بینید که ', typed('fascist', `${T.fascists} دیگرِ`), ' این بازی ', ...seatList(game, others.map(seatOf)), ' هستند.'));
          }
          for (const other of others) markFascist(other);
        }
      } else if (!silent) {
        const count = settings.fascistCount;
        const countText = count === 1 ? 'یک فاشیست' : count === 2 ? 'دو فاشیست' : 'سه فاشیست';
        if (game.general.monarchistSH) {
          player.gameChats.push(
            line(
              'در این بازی ',
              typed('fascist', countText),
              count === 1 ? ' هست و آن‌ها نمی‌دانند شما کی هستید، چون او ' : ' هست و آن‌ها می‌دانند شما کی هستید، به‌جز ',
              typed('monarchist', T.monarchist),
              '.'
            )
          );
        } else {
          player.gameChats.push(line('در این بازی ', typed('fascist', countText), ' هست و آن‌ها می‌دانند شما کی هستید.'));
        }
      }
    } else if (game.general.avalonSH && cardName === 'merlin') {
      const fascists = seatedPlayers.filter((play) => play.role.team === 'fascist');
      player.gameChats.push(line('می‌بینید که ', typed('fascist', T.fascists), ' این بازی ', ...seatList(game, fascists.map(seatOf)), ' هستند.'));
      for (const other of fascists) markFascist(other, false);
    } else if (game.general.avalonSH?.withPercival && cardName === 'percival') {
      const hasMorgana = seatedPlayers.some((play) => play.role.cardName === 'morgana');
      const candidates = seatedPlayers.filter(
        (play) => play.role.cardName === 'merlin' || (hasMorgana ? play.role.cardName === 'morgana' : play.role.cardName === 'monarchist')
      );
      player.gameChats.push(
        line(
          'می‌بینید که ',
          typed('merlin', T.merlin),
          ' و ',
          typed('morgana', T.morgana),
          ' ',
          seatTag(game, seatOf(candidates[0])),
          ' و ',
          seatTag(game, seatOf(candidates[1])),
          ' هستند، اما نمی‌دانید کدام کدام است.'
        )
      );
      player.playersState[seatOf(candidates[0])].nameStatus = 'merlin_candidate';
      player.playersState[seatOf(candidates[1])].nameStatus = 'merlin_candidate';
    }

    player.playersState[i].cardStatus.isFlipped = true;
  });
  sendInProgressGameUpdate(game);
}

/** Deals roles and runs the opening sequence, then hands over to the first election. */
function beginGame(game: Game): void {
  const { experiencedMode } = game.general;

  game.general.timeStarted = Date.now();
  applyStandardSettings(game);
  shufflePolicies(game, true);

  const roles = buildRoles(game);

  game.general.status = 'در حال پخش نقش‌ها…';
  for (const player of game.publicPlayersState) player.cardStatus.cardDisplayed = true;

  dealRoles(game, roles);

  const seated = game.private.seatedPlayers;
  const libPlayers = seated.filter((player) => player.role.team === 'liberal').map((player) => player.userName);
  const fasPlayers = seated.filter((player) => player.role.team !== 'liberal').map((player) => player.userName);

  game.private.summary = new GameSummary(
    game.general.uid,
    new Date(),
    {
      rebalance6p: game.general.rebalance6p && seated.length === 6,
      rebalance7p: game.general.rebalance7p && seated.length === 7,
      rebalance9p: false,
      rerebalance9p: game.general.rerebalance9p && seated.length === 9,
      casualGame: Boolean(game.general.casualGame),
      practiceGame: Boolean(game.general.practiceGame),
      unlistedGame: Boolean(game.general.unlistedGame),
      avalonSH: game.general.avalonSH,
      monarchistSH: game.general.monarchistSH,
      noTopdecking: game.general.noTopdecking,
    },
    game.customGameSettings,
    seated.map((player) => ({ username: player.userName, role: player.role.cardName, icon: player.role.icon })),
    { overall: 1600, season: 1600 },
    { overall: 1600, season: 1600 }
  );

  // The teams' average Elo is recorded when the database answers.
  void getEloForGameStart(seated.map((player) => player.userName)).then((elo) => {
    const average = (names: string[], pick: 'overall' | 'season') =>
      names.reduce((sum, name) => sum + (elo[name]?.[pick] ?? 1600), 0) / names.length;
    game.private.summary.libElo = { overall: average(libPlayers, 'overall'), season: average(libPlayers, 'season') };
    game.private.summary.fasElo = { overall: average(fasPlayers, 'overall'), season: average(fasPlayers, 'season') };
  });

  game.private.unSeatedGameChats = [line('بازی آغاز می‌شود.')];

  sendInProgressGameUpdate(game);
  if (!seated.some((player) => player.role.cardName === 'hitler')) return;

  const devFast = (normal: number, experienced = normal) => (isDevelopment() ? 100 : experiencedMode ? experienced : normal);

  setTimeout(() => revealKnowledge(game), devFast(2000, 200));

  setTimeout(() => {
    seated.forEach((player, i) => {
      if (!player.playersState) return;
      player.playersState[i].cardStatus.isFlipped = false;
      for (const view of player.playersState) view.notificationStatus = '';
    });
    sendInProgressGameUpdate(game, true);
  }, isDevelopment() ? 100 : 5000);

  setTimeout(() => {
    for (const player of game.publicPlayersState) player.cardStatus.cardDisplayed = false;
    sendInProgressGameUpdate(game, true);
  }, devFast(7000, 5200));

  setTimeout(() => {
    for (const player of seated) {
      for (const view of player.playersState) view.cardStatus = {};
    }
    game.gameState.presidentIndex = -1;
    startElection(game);
  }, devFast(9000, 5400));

  if (!isDevelopment()) {
    for (const player of game.publicPlayersState) {
      const socket = getHub().allSockets().find((s) => s.username === player.userName);
      socket?.emit('pingPlayer', `${T.game}: بازی شروع شد!`);
    }
  }

}

/**
 * The table is full and the countdown has run out: seats are shuffled, the
 * tracks flip and the opening sequence begins.
 */
export function startGame(game: Game): void {
  game.gameState.isTracksFlipped = true;
  let pause = isDevelopment() ? 1 : 5;

  const countdown = setInterval(() => {
    if (!pause) {
      clearInterval(countdown);
      beginGame(game);
    } else {
      game.general.status = `بازی تا ${formatNumber(pause)} ثانیه‌ی دیگر شروع می‌شود.`;
      sendInProgressGameUpdate(game, true);
      pause--;
    }
  }, 1000);

  game.private.hiddenInfoChat = [];
  game.private.hiddenInfoSubscriptions = [];
  game.private.hiddenInfoShouldNotify = true;

  game.general.playerCount = game.publicPlayersState.length;
  game.general.livingPlayerCount = game.publicPlayersState.length;
  game.general.type = game.general.playerCount < 7 ? 0 : game.general.playerCount < 9 ? 1 : 2;
  game.publicPlayersState = shuffle(game.publicPlayersState);
  // The seated copy starts from the public seat; roles and views are dealt next.
  game.private.seatedPlayers = structuredClone(game.publicPlayersState).map((player) => ({
    ...player,
    gameChats: [],
    wasInvestigated: false,
  })) as unknown as SeatedPlayer[];
  game.gameState.audioCue = '';
  game.private.policies = [];
  game.private.voteSpamData = game.private.seatedPlayers.map(() => ({ unvoteTimer: -1 }));
}
