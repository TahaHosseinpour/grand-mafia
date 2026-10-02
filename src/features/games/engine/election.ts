import { formatNumber } from '@/lib/datetime';
import { T } from '@/lib/glossary';
import { line, namedSeatTag, policyLetter, seatTag, tellAll, tellAllUnlessSilent, typed } from './chat';
import { settingsOf, shufflePolicies, startElection } from './common';
import { assassinateMerlin } from './assassination';
import { ballotCards, FROZEN_MESSAGE, REMADE_MESSAGE, selectChancellor } from './election-util';
import { completeGame } from './end-game';
import { sendGameList } from './lists';
import {
  executePlayer,
  investigateLoyalty,
  policyPeek,
  policyPeekAndDrop,
  selectPartyMembershipInvestigate,
  selectPlayerToExecute,
  selectPolicies,
  selectSpecialElection,
  showPlayerLoyalty,
  specialElection,
} from './policy-powers';
import { gameReportHeader, makeReport } from './report';
import { shuffle } from './shuffle';
import { fast, pace, paceKeepDev, timedModeMs } from './timing';
import { getHub } from './store';
import { sendInProgressGameUpdate, sendInProgressModChatUpdate } from './updates';
import type { HubSocket } from './hub';
import type { Caller, CardFlinger, Game, PolicyName, PowerName, SeatedPlayer } from './types';

type MaybeSocket = HubSocket | null | undefined;

/** What a presidential power does, and the line announcing it. */
const POWERS: Record<PowerName, { run: (game: Game) => void; text: string }> = {
  investigate: { run: investigateLoyalty, text: `${T.president} باید عضویت حزبی یکی از بازیکنان دیگر را بررسی کند.` },
  deckpeek: { run: policyPeek, text: `${T.president} باید سه قانون رویی دسته را ببیند.` },
  election: { run: specialElection, text: `${T.president} باید بازیکنی را برای انتخابات ویژه برگزیند.` },
  bullet: { run: executePlayer, text: `${T.president} باید بازیکنی را برای اعدام برگزیند.` },
  reverseinv: { run: showPlayerLoyalty, text: `${T.president} باید عضویت حزبی خود را به بازیکن دیگری نشان دهد.` },
  peekdrop: { run: policyPeekAndDrop, text: `${T.president} باید قانون رویی دسته را ببیند و می‌تواند آن را دور بیندازد.` },
};

/** Locks the legacy engine released whenever a policy was enacted. */
const ROUND_LOCKS = [
  'selectChancellor',
  'selectChancellorVoteOnVeto',
  'selectChancellorPolicy',
  'policyPeek',
  'policyPeekAndDrop',
  'selectPlayerToExecute',
  'executePlayer',
  'selectSpecialElection',
  'specialElection',
  'selectPartyMembershipInvestigate',
  'investigateLoyalty',
  'showPlayerLoyalty',
  'selectPartyMembershipInvestigateReverse',
  'selectPolicies',
  'selectOnePolicy',
  'selectBurnCard',
] as const;

const ORDINALS = ['', 'اولین', 'دومین', 'سومین', 'چهارمین', 'پنجمین'];

const forcedByTimer = (game: Game, userName: string, what: string) =>
  game.private.replayGameChats.push(line(typed('player', userName), ` توسط زمان‌سنج مجبور شد ${what}.`));

function clearTimer(game: Game): void {
  if (game.general.timedMode && game.private.timerId) {
    clearTimeout(game.private.timerId);
    game.private.timerId = null;
    game.gameState.timedModeEnabled = false;
  }
}

function armTimer(game: Game, onExpire: () => void): void {
  if (!game.general.timedMode) return;
  if (game.private.timerId) {
    clearTimeout(game.private.timerId);
    game.private.timerId = null;
  }
  game.gameState.timedModeEnabled = true;
  game.private.timerId = setTimeout(() => {
    if (game.gameState.timedModeEnabled) onExpire();
  }, timedModeMs(game));
}

/** Frozen / remade games refuse input; the player is told why. */
function refuseIfBlocked(game: Game, socket: MaybeSocket, force = false): boolean {
  if (game.gameState.isGameFrozen && !force) {
    socket?.emit('sendAlert', FROZEN_MESSAGE);
    return true;
  }
  if (game.general.isRemade && !force) {
    socket?.emit('sendAlert', REMADE_MESSAGE);
    return true;
  }
  return false;
}

/** Reveals every role on the table: the game is about to be decided. */
function revealAllRoles(game: Game): void {
  game.publicPlayersState.forEach((player, i) => {
    player.cardStatus.cardFront = 'secretrole';
    player.cardStatus.cardBack = game.private.seatedPlayers[i].role;
    player.cardStatus.cardDisplayed = true;
    player.cardStatus.isFlipped = false;
  });
}

/**
 * Enacts a policy on its track, then — depending on what it does — ends the
 * game, hands the president a power, or starts the next election.
 */
export function enactPolicy(game: Game, team: PolicyName, socket?: MaybeSocket): void {
  const index = game.trackState.enactedPolicies.length;

  for (const lock of ROUND_LOCKS) {
    if (game.private.lock[lock]) game.private.lock[lock] = false;
  }

  game.gameState.pendingChancellorIndex = null;
  game.private.summary.updateLog({ enactedPolicy: team });

  game.general.status = 'یک قانون در حال تصویب است.';
  if (team === 'liberal') game.trackState.liberalPolicyCount++;
  else game.trackState.fascistPolicyCount++;
  sendGameList();

  game.trackState.enactedPolicies.push({ position: 'middle', cardBack: team, isFlipped: false });
  sendInProgressGameUpdate(game, true);

  setTimeout(() => {
    game.trackState.enactedPolicies[index].isFlipped = true;
    game.gameState.audioCue = team === 'liberal' ? 'enactPolicyL' : 'enactPolicyF';
    sendInProgressGameUpdate(game, true);
  }, pace(game, 2000, 300));

  setTimeout(() => {
    game.gameState.audioCue = '';
    const count = team === 'liberal' ? game.trackState.liberalPolicyCount : game.trackState.fascistPolicyCount;
    const enactedChat = line(
      'یک ',
      typed(team, team === 'liberal' ? T.liberalPolicy : T.fascistPolicy),
      ` تصویب شد. (${formatNumber(count)}/${formatNumber(team === 'liberal' ? 5 : 6)})`
    );

    const rememberGovernment = () => {
      for (const player of game.publicPlayersState) {
        if (player.previousGovernmentStatus) player.previousGovernmentStatus = '';
      }
      const chancellorSeat = game.publicPlayersState.findIndex((player) => player.governmentStatus === 'isChancellor');
      if (game.trackState.electionTrackerCount <= 2 && chancellorSeat > -1) {
        game.publicPlayersState[game.gameState.presidentIndex].previousGovernmentStatus = 'wasPresident';
        game.publicPlayersState[chancellorSeat].previousGovernmentStatus = 'wasChancellor';
      }
    };

    const settings = settingsOf(game);
    const powerName = team === 'fascist' ? settings.powers[game.trackState.fascistPolicyCount - 1] : null;
    const power = powerName ? POWERS[powerName] : null;

    game.trackState.enactedPolicies[index].position =
      team === 'liberal' ? `liberal${game.trackState.liberalPolicyCount}` : `fascist${game.trackState.fascistPolicyCount}`;

    tellAllUnlessSilent(game, enactedChat);

    if (game.general.avalonSH && game.trackState.liberalPolicyCount === 5) {
      assassinateMerlin(game);
    } else if (game.trackState.liberalPolicyCount === 5 || game.trackState.fascistPolicyCount === 6) {
      revealAllRoles(game);
      sendInProgressGameUpdate(game);

      game.gameState.audioCue = game.trackState.liberalPolicyCount === 5 ? 'liberalsWin' : 'fascistsWin';
      setTimeout(() => {
        for (const player of game.publicPlayersState) player.cardStatus.isFlipped = true;
        game.gameState.audioCue = '';
        completeGame(game, game.trackState.liberalPolicyCount === 5 ? 'liberal' : 'fascist');
      }, fast(2000));
    } else if (power && powerName && game.trackState.electionTrackerCount <= 2) {
      tellAllUnlessSilent(game, line(power.text));
      power.run(game);
      rememberGovernment();

      if (game.general.timedMode) {
        const { presidentIndex } = game.gameState;
        const { seatedPlayers } = game.private;

        armTimer(game, () => {
          const president = seatedPlayers[presidentIndex];
          let candidates = seatedPlayers.filter((_, i) => i !== presidentIndex && !seatedPlayers[i].isDead);
          game.gameState.timedModeEnabled = false;

          // A fascist who is not Hitler never shoots Hitler at random.
          const pick = () => seatedPlayers.indexOf(shuffle(candidates)[0]);

          switch (powerName) {
            case 'deckpeek':
              selectPolicies({ username: president.userName }, game);
              forcedByTimer(game, president.userName, 'نگاهی به قوانین بیندازد');
              break;
            case 'bullet':
              if (president.role.team === 'fascist' && president.role.cardName !== 'hitler') {
                candidates = candidates.filter((player) => player.role.cardName !== 'hitler');
              }
              selectPlayerToExecute({ username: president.userName }, game, { playerIndex: pick() }, socket);
              forcedByTimer(game, president.userName, 'بازیکنی تصادفی را اعدام کند');
              break;
            case 'investigate':
              selectPartyMembershipInvestigate({ username: president.userName }, game, { playerIndex: pick() }, socket);
              forcedByTimer(game, president.userName, 'بازیکنی تصادفی را بررسی کند');
              break;
            case 'election':
              selectSpecialElection({ username: president.userName }, game, { playerIndex: pick() }, socket);
              forcedByTimer(game, president.userName, 'بازیکنی تصادفی را برای انتخابات ویژه برگزیند');
              break;
            default:
              break;
          }
        });
        sendInProgressGameUpdate(game);
      }
    } else {
      sendInProgressGameUpdate(game);
      rememberGovernment();
      startElection(game);
    }

    game.trackState.electionTrackerCount = 0;
  }, pace(game, 4000, 1000));
}

/** Sets a card flinger's pair of ballot buttons to the chosen one. */
function markChoice(cards: CardFlinger[], choseFirst: boolean): void {
  cards[0].action = cards[1].action = '';
  cards[0].cardStatus.isFlipped = cards[1].cardStatus.isFlipped = false;
  cards[0].notificationStatus = choseFirst ? 'selected' : '';
  cards[1].notificationStatus = choseFirst ? '' : 'selected';
}

const vetoVoteText = (vote: boolean) =>
  vote ? ' با وتوی این انتخابات موافقت کرد.' : ' با وتوی این انتخابات مخالفت کرد.';

/** Which seat holds a government role right now. */
const governmentSeat = (game: Game, status: 'isPresident' | 'isChancellor') =>
  game.publicPlayersState.findIndex((player) => player.governmentStatus === status);

/**
 * With the veto power active the president answers the chancellor's veto
 * request. Both agreeing discards the hand and advances the tracker.
 */
export function selectPresidentVoteOnVeto(caller: Caller, game: Game, data: { vote: boolean }, socket?: MaybeSocket): void {
  const president = game.private.seatedPlayers[game.gameState.presidentIndex];
  const chancellorIndex = governmentSeat(game, 'isChancellor');
  const publicChancellor = game.publicPlayersState[chancellorIndex];
  const publicPresident = game.publicPlayersState[game.gameState.presidentIndex];

  if (refuseIfBlocked(game, socket)) return;
  if (!president || president.userName !== caller.username) return;
  if (game.gameState.phase !== 'presidentVoteOnVeto') return;

  game.private.summary.updateLog({ presidentVeto: data.vote });

  if (
    game.private.lock.selectPresidentVoteOnVeto ||
    !Number.isInteger(chancellorIndex) ||
    !publicChancellor ||
    !president.cardFlingerState?.[0]
  ) {
    return;
  }

  game.private.lock.selectPresidentVoteOnVeto = true;
  publicChancellor.isLoader = false;
  publicPresident.isLoader = false;
  markChoice(president.cardFlingerState, data.vote);
  publicPresident.cardStatus = { cardDisplayed: true, cardFront: 'ballot', cardBack: { cardName: data.vote ? 'ja' : 'nein' } };

  sendInProgressGameUpdate(game);

  setTimeout(() => {
    const seat = game.private.seatedPlayers.indexOf(president);
    tellAllUnlessSilent(game, line(`${T.president} `, seatTag(game, seat), vetoVoteText(data.vote)));

    publicPresident.cardStatus.isFlipped = true;
    sendInProgressGameUpdate(game);

    if (data.vote) {
      game.trackState.electionTrackerCount++;
      tellAllUnlessSilent(
        game,
        line(
          `${T.president} و ${T.chancellor} با وتوی این انتخابات موافقت کردند و ${T.electionTracker} یک خانه جلو می‌رود. (${formatNumber(game.trackState.electionTrackerCount)}/${formatNumber(3)})`
        )
      );
      game.gameState.audioCue = 'passedVeto';
      setTimeout(() => {
        game.gameState.audioCue = '';
        president.cardFlingerState = [];
        if (game.trackState.electionTrackerCount <= 2 && governmentSeat(game, 'isChancellor') > -1) {
          for (const player of game.publicPlayersState) {
            if (player.previousGovernmentStatus) player.previousGovernmentStatus = '';
          }
          game.publicPlayersState[game.gameState.presidentIndex].previousGovernmentStatus = 'wasPresident';
          game.publicPlayersState[chancellorIndex].previousGovernmentStatus = 'wasChancellor';
        }
        if (game.trackState.electionTrackerCount >= 3) {
          game.gameState.previousElectedGovernment = [];
          if (!game.gameState.undrawnPolicyCount) shufflePolicies(game);

          enactPolicy(game, game.private.policies.shift() as PolicyName, socket);
          game.gameState.undrawnPolicyCount--;
          if (game.gameState.undrawnPolicyCount < 3) shufflePolicies(game);
        } else {
          startElection(game);
        }

        game.gameState.pendingChancellorIndex = null;
        game.private.lock.selectChancellorPolicy = false;
        game.private.lock.selectPresidentVoteOnVeto = false;
        game.private.lock.selectChancellorVoteOnVeto = false;
      }, pace(game, 3000, 1000));
    } else {
      game.gameState.audioCue = 'failedVeto';
      sendInProgressGameUpdate(game);
      setTimeout(() => {
        game.gameState.audioCue = '';
        publicPresident.cardStatus.cardDisplayed = false;
        publicChancellor.cardStatus.cardDisplayed = false;
        president.cardFlingerState = [];
        enactPolicy(game, game.private.currentElectionPolicies[0], socket);
        setTimeout(() => {
          publicChancellor.cardStatus.isFlipped = publicPresident.cardStatus.isFlipped = false;
        }, 1000);
      }, pace(game, 2000, 1000));
    }
  }, pace(game, 2000, 500));
}

/** The chancellor asks, or declines, to veto the policy they just chose. */
export function selectChancellorVoteOnVeto(caller: Caller, game: Game, data: { vote: boolean }, socket?: MaybeSocket): void {
  const president = game.private.seatedPlayers[game.gameState.presidentIndex];
  const chancellorIndex = governmentSeat(game, 'isChancellor');
  const chancellor = game.private.seatedPlayers.find((player) => player.userName === game.private._chancellorPlayerName);
  const publicChancellor = game.publicPlayersState[chancellorIndex];

  if (refuseIfBlocked(game, socket)) return;
  if (!publicChancellor?.userName || caller.username !== publicChancellor.userName) return;
  if (game.gameState.phase !== 'chancellorVoteOnVeto') return;

  game.private.summary.updateLog({ chancellorVeto: data.vote });

  game.private.lock.selectPresidentVoteOnVeto = false;
  if (game.private.lock.selectChancellorVoteOnVeto || !chancellor?.cardFlingerState?.length || !game.publicPlayersState[chancellorIndex]) {
    return;
  }

  game.private.lock.selectChancellorVoteOnVeto = true;
  game.publicPlayersState[chancellorIndex].isLoader = false;
  markChoice(chancellor.cardFlingerState, data.vote);
  publicChancellor.cardStatus = { cardDisplayed: true, cardFront: 'ballot', cardBack: { cardName: data.vote ? 'ja' : 'nein' } };

  sendInProgressGameUpdate(game);

  setTimeout(() => {
    tellAllUnlessSilent(game, line(`${T.chancellor} `, seatTag(game, chancellorIndex), vetoVoteText(data.vote)));

    publicChancellor.cardStatus.isFlipped = true;
    sendInProgressGameUpdate(game);

    if (data.vote) {
      president.cardFlingerState = ballotCards().map((card) => ({ ...card, cardStatus: { ...card.cardStatus } }));

      if (!game.general.disableGamechat) {
        president.gameChats.push(
          line('شما باید رأی بدهید که این قوانین وتو شوند یا نه. «آری» یعنی وتوی قوانینی که به صدراعظم دادید، «نه» یعنی تصویب قانونی که صدراعظم در خفا انتخاب کرده است.')
        );
      }

      game.general.status = `${T.president} باید درباره‌ی وتوی قانون رأی دهد.`;
      sendInProgressGameUpdate(game);

      setTimeout(() => {
        const cards = president.cardFlingerState as CardFlinger[];
        cards[0].cardStatus.isFlipped = cards[1].cardStatus.isFlipped = true;
        cards[0].notificationStatus = cards[1].notificationStatus = 'notification';
        chancellor.cardFlingerState = [];
        game.publicPlayersState[game.gameState.presidentIndex].isLoader = true;
        game.gameState.phase = 'presidentVoteOnVeto';
        sendInProgressGameUpdate(game);

        armTimer(game, () => {
          game.gameState.timedModeEnabled = false;
          selectPresidentVoteOnVeto({ username: president.userName }, game, { vote: Math.random() < 0.5 }, socket);
          forcedByTimer(game, president.userName, 'یک رأی تصادفی درباره‌ی وتو بدهد');
        });
      }, pace(game, 1000, 500));
    } else {
      game.gameState.audioCue = 'failedVeto';
      sendInProgressGameUpdate(game);
      setTimeout(() => {
        game.gameState.audioCue = '';
        publicChancellor.cardStatus.cardDisplayed = false;
        chancellor.cardFlingerState = [];
        setTimeout(() => {
          publicChancellor.cardStatus.isFlipped = false;
        }, 1000);
        enactPolicy(game, game.private.currentElectionPolicies[0], socket);
      }, pace(game, 2000, 500));
    }
  }, pace(game, 2000, 500));
}

/** What a human-looking report says about a chancellor's pick (suspicious plays only). */
function reportChancellorPick(game: Game, chancellor: SeatedPlayer, chancellorIndex: number, enacted: PolicyName): void {
  const options = game.private.currentChancellorOptions;
  const base = { player: chancellor.userName, seat: chancellorIndex + 1, role: chancellor.role.cardName, ...gameReportHeader(game) };

  if (chancellor.role.team === 'liberal' && enacted === 'fascist' && options.includes('liberal')) {
    makeReport({ ...base, situation: 'به‌عنوان صدراعظم حق انتخاب داشت و قانون فاشیستی تصویب کرد.' }, game, 'report');
  }
  if (chancellor.role.team === 'fascist' && enacted === 'liberal' && game.trackState.liberalPolicyCount >= 4 && options.includes('fascist')) {
    makeReport({ ...base, situation: 'به‌عنوان صدراعظم با ۴ قانون لیبرال روی جدول حق انتخاب داشت و قانون لیبرال تصویب کرد.' }, game, 'report');
  }
}

/** The chancellor enacts one of the two policies they were passed (selection 1 or 3). */
export function selectChancellorPolicy(
  caller: Caller,
  game: Game,
  data: { selection: number },
  wasTimer: boolean,
  socket?: MaybeSocket
): void {
  const { experiencedMode } = game.general;
  const presidentIndex = governmentSeat(game, 'isPresident');
  const president = game.private.seatedPlayers[presidentIndex];
  const chancellorIndex = governmentSeat(game, 'isChancellor');
  const chancellor = game.private.seatedPlayers[chancellorIndex];
  const enactedPolicy = game.private.currentChancellorOptions[data.selection === 3 ? 1 : 0];

  if (refuseIfBlocked(game, socket)) return;
  if (!chancellor || chancellor.userName !== caller.username) return;

  if (game.private.lock.selectChancellorPolicy || !chancellor.cardFlingerState?.length) return;

  if (!wasTimer && !game.general.private) reportChancellorPick(game, chancellor, chancellorIndex, enactedPolicy);

  const modLine = line(
    `${T.chancellor} `,
    namedSeatTag(game, chancellorIndex),
    wasTimer ? ' به‌صورت خودکار ' : ' ',
    typed(enactedPolicy, enactedPolicy === 'liberal' ? T.liberalPolicy : T.fascistPolicy),
    wasTimer ? ' را برای تصویب انتخاب کرد، چون زمان تمام شد.' : ' را برای تصویب انتخاب کرد.'
  );
  game.private.hiddenInfoChat.push(modLine);
  sendInProgressModChatUpdate(game, modLine);

  game.private.lock.selectPresidentPolicy = false;
  clearTimer(game);
  game.private.lock.selectChancellorPolicy = true;

  chancellor.cardFlingerState[0].notificationStatus = data.selection === 3 ? '' : 'selected';
  chancellor.cardFlingerState[1].notificationStatus = data.selection === 3 ? 'selected' : '';

  game.publicPlayersState[chancellorIndex].isLoader = false;
  chancellor.cardFlingerState[0].action = chancellor.cardFlingerState[1].action = '';
  chancellor.cardFlingerState[0].cardStatus.isFlipped = chancellor.cardFlingerState[1].cardStatus.isFlipped = false;

  if (game.gameState.isVetoEnabled) {
    game.private.currentElectionPolicies = [enactedPolicy];
    game.general.status = `${T.chancellor} باید درباره‌ی وتوی قانون رأی دهد.`;
    sendInProgressGameUpdate(game);

    setTimeout(() => {
      game.publicPlayersState[chancellorIndex].isLoader = true;
      chancellor.cardFlingerState = ballotCards().map((card) => ({ ...card, cardStatus: { ...card.cardStatus } }));

      if (!game.general.disableGamechat) {
        chancellor.gameChats.push(
          line('شما باید رأی بدهید که این قانون وتو شود یا نه. «آری» یعنی وتوی قانونی که انتخاب کرده‌اید، «نه» یعنی تصویب آن.')
        );
      }
      sendInProgressGameUpdate(game);

      setTimeout(() => {
        const cards = chancellor.cardFlingerState as CardFlinger[];
        cards[0].cardStatus.isFlipped = cards[1].cardStatus.isFlipped = true;
        cards[0].notificationStatus = cards[1].notificationStatus = 'notification';
        game.gameState.phase = 'chancellorVoteOnVeto';

        armTimer(game, () => {
          game.gameState.timedModeEnabled = false;
          selectChancellorVoteOnVeto({ username: chancellor.userName }, game, { vote: Math.random() < 0.5 }, socket);
          forcedByTimer(game, chancellor.userName, 'یک رأی تصادفی درباره‌ی وتو بدهد');
        });

        sendInProgressGameUpdate(game);
      }, pace(game, 1000, 500));
    }, pace(game, 2000, 1000));
  } else {
    game.private.currentElectionPolicies = [];
    game.gameState.phase = 'enactPolicy';
    sendInProgressGameUpdate(game);
    setTimeout(() => {
      chancellor.cardFlingerState = [];
      enactPolicy(game, enactedPolicy, socket);
    }, paceKeepDev(game, 2000, 200));
  }

  // The government may now claim what it saw.
  if (experiencedMode) {
    president.playersState[presidentIndex].claim = 'wasPresident';
    chancellor.playersState[chancellorIndex].claim = 'wasChancellor';
  } else {
    setTimeout(() => {
      president.playersState[presidentIndex].claim = 'wasPresident';
      chancellor.playersState[chancellorIndex].claim = 'wasChancellor';
      sendInProgressGameUpdate(game);
    }, 3000);
  }
}

/** Reports a president whose discard looks like throwing (not for private/casual games). */
function reportPresidentDiscard(
  game: Game,
  president: SeatedPlayer,
  presidentIndex: number,
  chancellor: SeatedPlayer,
  discarded: PolicyName,
  passed: [PolicyName, PolicyName]
): void {
  const track4blue = game.trackState.liberalPolicyCount >= 4;
  const trackReds = game.trackState.fascistPolicyCount;
  const passedPair = passed[0] === 'liberal' ? (passed[1] === 'liberal' ? 'BB' : 'BR') : passed[1] === 'liberal' ? 'BR' : 'RR';
  const base = { player: president.userName, seat: presidentIndex + 1, role: president.role.cardName, ...gameReportHeader(game) };
  const report = (situation: string) => makeReport({ ...base, situation }, game, 'report');

  if (president.role.team === 'liberal') {
    if (discarded !== 'liberal') return;
    if (track4blue) {
      if (passedPair === 'RR') report('با ۴ قانون لیبرال روی جدول BRR گرفت و قانون لیبرال را دور انداخت.');
      else if (passedPair === 'BR') report('با ۴ قانون لیبرال روی جدول BBR گرفت و قانون لیبرالِ پنجم را اجبار نکرد.');
    } else if (trackReds < 3) {
      if (passedPair === 'RR') report('پیش از منطقه‌ی هیتلر BRR گرفت و قانون لیبرال را دور انداخت.');
    } else if (trackReds === 5) {
      if (passedPair === 'RR') report('در منطقه‌ی وتو BRR گرفت و قانون لیبرال را دور انداخت.');
      else if (passedPair === 'BR') report('در منطقه‌ی وتو BBR گرفت و به صدراعظم حق انتخاب داد.');
    }
  } else if (discarded === 'fascist') {
    if (track4blue) {
      if (passedPair === 'BB' && chancellor.role.team !== 'liberal') {
        report('با ۴ قانون لیبرال روی جدول BBR گرفت و قانون لیبرال را به صدراعظمِ فاشیست اجبار کرد.');
      } else if (passedPair === 'BR' && chancellor.role.team === 'liberal') {
        report('با ۴ قانون لیبرال روی جدول BRR گرفت و به صدراعظمِ لیبرال حق انتخاب داد.');
      }
    } else if (trackReds === 5) {
      if (passedPair === 'BB' && chancellor.role.team !== 'liberal') {
        report('با ۵ قانون فاشیستی روی جدول BBR گرفت و قانون لیبرال را به صدراعظمِ فاشیست اجبار کرد.');
      } else if (passedPair === 'BR' && chancellor.role.team === 'liberal') {
        report('با ۵ قانون فاشیستی روی جدول BRR گرفت و به صدراعظمِ لیبرال حق انتخاب داد.');
      }
    }
  }
}

/** The president discards one of the three policies they drew (selection 0–2). */
export function selectPresidentPolicy(
  caller: Caller,
  game: Game,
  data: { selection: number },
  wasTimer: boolean,
  socket?: MaybeSocket
): void {
  const { presidentIndex } = game.gameState;
  const president = game.private.seatedPlayers[presidentIndex];
  const chancellorIndex = governmentSeat(game, 'isChancellor');
  const chancellor = game.private.seatedPlayers[chancellorIndex];
  const kept = [0, 1, 2].filter((num) => num !== data.selection);

  if (refuseIfBlocked(game, socket)) return;
  if (!president || president.userName !== caller.username || kept.length !== 2) return;

  if (
    game.private.lock.selectPresidentPolicy ||
    !president.cardFlingerState?.length ||
    !Number.isInteger(chancellorIndex) ||
    !game.publicPlayersState[chancellorIndex]
  ) {
    return;
  }

  clearTimer(game);

  const hand = game.private.currentElectionPolicies;
  const discarded = hand[data.selection];

  const modLine = line(
    `${T.president} `,
    namedSeatTag(game, presidentIndex),
    wasTimer ? ' به‌صورت خودکار ' : ' ',
    typed(discarded, discarded === 'liberal' ? T.liberalPolicy : T.fascistPolicy),
    wasTimer ? ' را دور انداخت، چون زمان تمام شد.' : ' را دور انداخت.'
  );
  game.private.hiddenInfoChat.push(modLine);
  sendInProgressModChatUpdate(game, modLine);

  if (!wasTimer && !game.general.private) {
    reportPresidentDiscard(game, president, presidentIndex, chancellor, discarded, [hand[kept[0]], hand[kept[1]]]);
  }

  game.private.lock.selectPresidentPolicy = true;
  game.publicPlayersState[presidentIndex].isLoader = false;
  game.publicPlayersState[chancellorIndex].isLoader = true;

  const cards = president.cardFlingerState;
  cards.forEach((card, i) => {
    card.notificationStatus = i === data.selection ? 'selected' : '';
  });

  game.private.summary.updateLog({ chancellorHand: hand.filter((_, i) => i !== data.selection) });
  game.private.currentChancellorOptions = [hand[kept[0]], hand[kept[1]]];

  for (const card of cards) {
    card.action = '';
    card.cardStatus.isFlipped = false;
  }

  chancellor.cardFlingerState = [
    { position: 'middle-left', action: 'active', cardStatus: { isFlipped: false, cardFront: 'policy', cardBack: `${hand[kept[0]]}p` } },
    { position: 'middle-right', action: 'active', cardStatus: { isFlipped: false, cardFront: 'policy', cardBack: `${hand[kept[1]]}p` } },
  ];

  game.general.status = 'منتظر تصویب قانون توسط صدراعظم.';
  game.gameState.phase = 'chancellorSelectingPolicy';

  if (!game.general.experiencedMode && !game.general.disableGamechat) {
    chancellor.gameChats.push(line(`به‌عنوان ${T.chancellor} باید یکی از قوانین را تصویب کنید.`));
  }

  sendInProgressGameUpdate(game);

  setTimeout(() => {
    president.cardFlingerState = [];
    for (const card of chancellor.cardFlingerState ?? []) {
      card.cardStatus.isFlipped = true;
      card.notificationStatus = 'notification';
    }

    armTimer(game, () => {
      game.gameState.timedModeEnabled = false;
      const pickSecond = Math.random() < 0.5;
      selectChancellorPolicy({ username: chancellor.userName }, game, { selection: pickSecond ? 3 : 1 }, true, socket);
      forcedByTimer(game, chancellor.userName, 'یک قانون تصادفی را تصویب کند');
    });

    sendInProgressGameUpdate(game);
  }, game.general.experiencedMode ? 200 : 2000);
}

/** The first of a player's two seats-worth of state: the sockets of a user. */
function socketsOf(userName: string): HubSocket[] {
  return getHub().allSockets().filter((socket) => socket.username === userName);
}

/**
 * A ja/nein vote on the proposed government. Votes can be changed until the
 * last player votes; then the ballots are tallied and revealed.
 * @param force a moderator forced this vote
 */
export function selectVoting(caller: Caller, game: Game, data: { vote: boolean }, socket?: MaybeSocket, force = false): void {
  const { seatedPlayers } = game.private;
  const { experiencedMode } = game.general;
  const player = seatedPlayers.find((seated) => seated.userName === caller.username);
  const playerIndex = seatedPlayers.findIndex((seated) => seated.userName === caller.username);

  if (refuseIfBlocked(game, socket, force)) return;

  const passedElection = () => {
    const { gameState } = game;
    const { presidentIndex } = gameState;
    const chancellorIndex = governmentSeat(game, 'isChancellor');
    game.trackState.consecutiveTopdecks = 0;

    game.private._chancellorPlayerName = seatedPlayers[chancellorIndex].userName;

    // The previous government's unclaimed claims lapse.
    if (gameState.previousElectedGovernment.length) {
      for (const seat of gameState.previousElectedGovernment.slice(0, 2)) {
        seatedPlayers[seat].playersState[seat].claim = '';
        for (const sock of socketsOf(game.publicPlayersState[seat].userName).slice(0, 1)) sock.emit('removeClaim');
      }
    }

    game.general.status = 'منتظر دورریختن قانون توسط رئیس‌جمهور.';
    game.publicPlayersState[presidentIndex].isLoader = true;
    if (!experiencedMode && !game.general.disableGamechat) {
      seatedPlayers[presidentIndex].gameChats.push(line(`به‌عنوان ${T.president} باید یکی از قوانین را دور بیندازید.`));
    }

    if (gameState.undrawnPolicyCount < 3) shufflePolicies(game);

    gameState.undrawnPolicyCount--;
    game.private.currentElectionPolicies = [
      game.private.policies.shift() as PolicyName,
      game.private.policies.shift() as PolicyName,
      game.private.policies.shift() as PolicyName,
    ];

    const invalid = game.private.currentElectionPolicies.some((policy) => policy !== 'liberal' && policy !== 'fascist');
    if (invalid) {
      makeReport(
        {
          player: 'یک بازیکن',
          seat: presidentIndex + 1,
          role: seatedPlayers[presidentIndex].role.cardName,
          situation: `دسته‌ی نامعتبر دریافت کرد!\n${JSON.stringify(game.private.currentElectionPolicies)}`,
          ...gameReportHeader(game),
        },
        game,
        'report'
      );
    }

    const modLine = line(
      `${T.president} `,
      namedSeatTag(game, presidentIndex),
      ' دریافت کرد: ',
      ...game.private.currentElectionPolicies.map(policyLetter),
      '.'
    );
    game.private.hiddenInfoChat.push(modLine);
    sendInProgressModChatUpdate(game, modLine);

    game.private.summary.updateLog({ presidentHand: [...game.private.currentElectionPolicies] });

    const positions = ['middle-far-left', 'middle-center', 'middle-far-right'];
    seatedPlayers[presidentIndex].cardFlingerState = game.private.currentElectionPolicies.map((policy, i) => ({
      position: positions[i],
      action: 'active',
      cardStatus: { isFlipped: false, cardFront: 'policy', cardBack: `${policy}p` },
      discard: true,
    }));
    sendInProgressGameUpdate(game);

    // The three drawn cards leave the deck counter one by one.
    setTimeout(() => {
      gameState.undrawnPolicyCount--;
      sendInProgressGameUpdate(game);
    }, 200);
    setTimeout(() => {
      gameState.undrawnPolicyCount--;
      sendInProgressGameUpdate(game);
    }, 400);

    setTimeout(() => {
      const cards = seatedPlayers[presidentIndex].cardFlingerState as CardFlinger[];
      for (const card of cards) {
        card.cardStatus.isFlipped = true;
        card.notificationStatus = 'notification';
      }
      gameState.phase = 'presidentSelectingPolicy';

      game.gameState.previousElectedGovernment = [presidentIndex, chancellorIndex];

      armTimer(game, () => {
        game.gameState.timedModeEnabled = false;
        selectPresidentPolicy(
          { username: seatedPlayers[presidentIndex].userName },
          game,
          { selection: Math.floor(Math.random() * 3) },
          true,
          socket
        );
        forcedByTimer(game, seatedPlayers[presidentIndex].userName, 'یک قانون تصادفی را دور بیندازد');
      });
      sendInProgressGameUpdate(game);
    }, experiencedMode ? 200 : 600);
  };

  const failedElection = () => {
    game.trackState.electionTrackerCount++;

    if (game.trackState.electionTrackerCount >= 3) {
      const { noTopdecking } = game.general;
      if (noTopdecking === 1 || (noTopdecking === 2 && (game.trackState.consecutiveTopdecks ?? 0) >= 1)) {
        game.chats.push(line('بازی با «تاپ‌دک» تمام شد.'));
        revealAllRoles(game);
        game.gameState.audioCue = 'fascistsWin';
        sendInProgressGameUpdate(game, true);

        setTimeout(() => {
          for (const publicPlayer of game.publicPlayersState) publicPlayer.cardStatus.isFlipped = true;
          game.gameState.audioCue = '';
          completeGame(game, 'fascist');
        }, 2000);
        return;
      }
      if (noTopdecking === 2) game.trackState.consecutiveTopdecks = (game.trackState.consecutiveTopdecks ?? 0) + 1;

      game.gameState.previousElectedGovernment = [];
      tellAllUnlessSilent(game, line('سومین انتخابات پیاپی رد شد و قانون رویی دسته تصویب می‌شود.'));

      if (!game.gameState.undrawnPolicyCount) shufflePolicies(game);

      game.gameState.undrawnPolicyCount--;
      setTimeout(() => enactPolicy(game, game.private.policies.shift() as PolicyName, socket), pace(game, 2000, 500));
    } else {
      armTimer(game, () => {
        if (game.gameState.phase !== 'selectingChancellor') return;
        const [, candidates] = game.gameState.clickActionInfo as [string, number[]];
        const chancellorIndex = shuffle(candidates)[0];
        const president = seatedPlayers[game.gameState.presidentIndex];

        game.gameState.pendingChancellorIndex = null;
        game.gameState.timedModeEnabled = false;

        selectChancellor(null, { username: president.userName }, game, { chancellorIndex });
        forcedByTimer(game, president.userName, `یک ${T.chancellor} تصادفی انتخاب کند`);
      });

      setTimeout(() => startElection(game), pace(game, 2000, 500));
    }
  };

  const flipBallotCards = () => {
    if (!seatedPlayers[0]) return;
    const living = game.publicPlayersState.filter((p) => !p.isDead);
    const isConsensus = living.every((_, i) =>
      seatedPlayers[i] ? seatedPlayers[i].voteStatus?.didVoteYes === seatedPlayers[0].voteStatus?.didVoteYes : false
    );

    game.publicPlayersState.forEach((publicPlayer, i) => {
      if (!publicPlayer.isDead && seatedPlayers[i]) {
        (publicPlayer.cardStatus.cardBack as { cardName?: string }).cardName = seatedPlayers[i].voteStatus?.didVoteYes ? 'ja' : 'nein';
        publicPlayer.cardStatus.isFlipped = true;
      }
    });

    game.private.summary.updateLog({ votes: seatedPlayers.map((p) => p.voteStatus?.didVoteYes) });

    sendInProgressGameUpdate(game, true);

    setTimeout(
      () => {
        for (const publicPlayer of game.publicPlayersState) publicPlayer.cardStatus.cardDisplayed = false;

        setTimeout(() => {
          for (const publicPlayer of game.publicPlayersState) publicPlayer.cardStatus.isFlipped = false;
          sendInProgressGameUpdate(game);
        }, pace(game, 2000, 500));

        const yesVotes = seatedPlayers.filter((p) => p.voteStatus?.didVoteYes && !p.isDead).length;

        if (yesVotes / game.general.livingPlayerCount > 0.5) {
          const chancellorIndex = game.gameState.pendingChancellorIndex as number;
          const { presidentIndex } = game.gameState;

          game.publicPlayersState[presidentIndex].governmentStatus = 'isPresident';
          game.publicPlayersState[chancellorIndex].governmentStatus = 'isChancellor';

          if (!experiencedMode && !game.general.disableGamechat) tellAll(game, line('انتخابات تصویب می‌شود.'));

          const settings = settingsOf(game);
          if (
            game.trackState.fascistPolicyCount >= settings.hitlerZone &&
            seatedPlayers[chancellorIndex].role.cardName === 'hitler'
          ) {
            const hitlerLine = line(
              typed('hitler', T.hitler),
              ` پس از تصویب ${ORDINALS[settings.hitlerZone] ?? `${formatNumber(settings.hitlerZone)}‌امین`} قانون فاشیستی به‌عنوان ${T.chancellor} انتخاب شده است.`
            );
            if (game.general.monarchistSH) {
              hitlerLine.chat.push(
                { text: ' در نتیجه ' },
                typed('monarchist', T.monarchist),
                { text: ' همراه ' },
                typed('liberal', T.liberals),
                { text: ' باخته است.' }
              );
            }

            setTimeout(() => {
              game.publicPlayersState.forEach((publicPlayer, i) => {
                publicPlayer.cardStatus.cardFront = 'secretrole';
                publicPlayer.cardStatus.cardDisplayed = true;
                publicPlayer.cardStatus.cardBack = seatedPlayers[i].role;
              });

              if (!game.general.disableGamechat) {
                tellAll(game, hitlerLine);
                game.gameState.audioCue = 'fascistsWinHitlerElected';
              }
              sendInProgressGameUpdate(game);
            }, pace(game, 3000, 1000));

            setTimeout(() => {
              game.gameState.audioCue = '';
              for (const publicPlayer of game.publicPlayersState) publicPlayer.cardStatus.isFlipped = true;
              completeGame(game, 'fascist');
            }, pace(game, 4000, 2000));
          } else {
            passedElection();
          }
        } else {
          if (!game.general.disableGamechat) {
            tellAll(
              game,
              line(
                `انتخابات رد می‌شود و ${T.electionTracker} یک خانه جلو می‌رود. (${formatNumber(game.trackState.electionTrackerCount + 1)}/${formatNumber(3)})`
              )
            );
            game.gameState.pendingChancellorIndex = null;
          }

          failedElection();
        }

        sendInProgressGameUpdate(game);
      },
      process.env.NODE_ENV === 'development' ? 2100 : isConsensus ? 1500 : 6000
    );
  };

  if (game.private.lock.selectChancellor) game.private.lock.selectChancellor = false;

  const everyoneVoted = seatedPlayers.length === seatedPlayers.filter((play) => play?.voteStatus?.hasVoted).length;
  if (everyoneVoted || !player || !player.voteStatus) return;

  // Voting again flips the vote's state; a forced vote is final.
  player.voteStatus.hasVoted = !player.voteStatus.hasVoted ? true : player.voteStatus.didVoteYes ? !data.vote : data.vote;
  player.voteStatus.didVoteYes = player.voteStatus.hasVoted ? data.vote : false;

  if (player.voteStatus.hasVoted) {
    game.publicPlayersState[playerIndex].isLoader = false;
  } else {
    const spam = game.private.voteSpamData[playerIndex];
    if (spam.unvoteTimer !== -1) clearInterval(spam.unvoteTimer as NodeJS.Timeout);

    // A player who withdrew their vote shows as pending again.
    spam.unvoteTimer = setInterval(() => {
      if (game.gameState.phase !== 'voting') return;
      const recheck = seatedPlayers.find((seated) => seated.userName === caller.username);
      game.publicPlayersState[playerIndex].isLoader = !recheck?.voteStatus?.hasVoted;
      sendInProgressGameUpdate(game, true);
    }, 2000);
  }

  if (force) {
    player.voteStatus.hasVoted = true;
    player.voteStatus.didVoteYes = data.vote;
    game.publicPlayersState[playerIndex].isLoader = false;
  }

  const chosen = player.voteStatus.hasVoted ? 'selected' : 'notification';
  player.cardFlingerState = [
    {
      position: 'middle-left',
      notificationStatus: data.vote ? chosen : 'notification',
      action: 'active',
      cardStatus: { isFlipped: true, cardFront: 'ballot', cardBack: 'ja' },
    },
    {
      position: 'middle-right',
      notificationStatus: data.vote ? 'notification' : chosen,
      action: 'active',
      cardStatus: { isFlipped: true, cardFront: 'ballot', cardBack: 'nein' },
    },
  ];

  sendInProgressGameUpdate(game, true);

  const votedCount = seatedPlayers.filter((play) => play.voteStatus?.hasVoted && !play.isDead).length;
  if (votedCount !== game.general.livingPlayerCount) return;

  game.general.status = 'در حال شمارش آرا…';
  for (const seated of seatedPlayers) {
    if (seated.cardFlingerState?.length) {
      seated.cardFlingerState[0].action = seated.cardFlingerState[1].action = '';
      seated.cardFlingerState[0].cardStatus.isFlipped = seated.cardFlingerState[1].cardStatus.isFlipped = false;
    }
  }
  sendInProgressGameUpdate(game, true);

  setTimeout(() => {
    for (const seated of seatedPlayers) seated.cardFlingerState = [];
    sendInProgressGameUpdate(game, true);
  }, experiencedMode ? 200 : 2000);

  setTimeout(() => {
    clearTimer(game);
    flipBallotCards();
  }, pace(game, 3000, 2500));
}

