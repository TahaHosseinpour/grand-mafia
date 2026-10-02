import { policyAdjective, T, teamName } from '@/lib/glossary';
import { assassinateMerlin } from './assassination';
import { line, namedSeatTag, policyLetter, seatTag, tellAll, tellAllUnlessSilent, tellOthers, typed } from './chat';
import { shufflePolicies, startElection } from './common';
import { ballotCards, FROZEN_MESSAGE, REMADE_MESSAGE } from './election-util';
import { completeGame } from './end-game';
import { sendGameList } from './lists';
import { fast, pace, timedModeMs } from './timing';
import { sendInProgressGameUpdate, sendInProgressModChatUpdate } from './updates';
import type { HubSocket } from './hub';
import type { Caller, CardFlinger, Game, PolicyName, SeatedPlayer } from './types';

type MaybeSocket = HubSocket | null | undefined;

const policyLabel = (policy: PolicyName) => typed(policy, policyAdjective(policy));

/** The president's state, and their seat, for the current round. */
function presidentOf(game: Game): { seatedPlayers: SeatedPlayer[]; presidentIndex: number; president: SeatedPlayer } {
  const { seatedPlayers } = game.private;
  const { presidentIndex } = game.gameState;
  return { seatedPlayers, presidentIndex, president: seatedPlayers[presidentIndex] };
}

function clearTimer(game: Game, resetEnabled = true): void {
  if (game.general.timedMode && game.private.timerId) {
    clearTimeout(game.private.timerId);
    game.private.timerId = null;
    if (resetEnabled) game.gameState.timedModeEnabled = false;
  }
}

function blocked(game: Game, socket: MaybeSocket, silent = false): boolean {
  if (game.gameState.isGameFrozen) {
    if (!silent) socket?.emit('sendAlert', FROZEN_MESSAGE);
    return true;
  }
  if (game.general.isRemade) {
    if (!silent) socket?.emit('sendAlert', REMADE_MESSAGE);
    return true;
  }
  return false;
}

/** Three policy cards laid out for the president's peek / draw. */
function threeCards(policies: PolicyName[]): CardFlinger[] {
  const positions = ['middle-far-left', 'middle-center', 'middle-far-right'];
  return positions.map((position, i) => ({
    position,
    action: 'active',
    cardStatus: { isFlipped: false, cardFront: 'policy', cardBack: `${policies[i]}p` },
  }));
}

const setFlipped = (cards: CardFlinger[], flipped: boolean) => {
  for (const card of cards) card.cardStatus.isFlipped = flipped;
};

/** Who the president may target, never themselves or the dead. */
const livingOthers = (game: Game, extra: (player: SeatedPlayer, i: number) => boolean = () => true): number[] => {
  const { seatedPlayers, presidentIndex } = presidentOf(game);
  return seatedPlayers.map((_, i) => i).filter((i) => i !== presidentIndex && !seatedPlayers[i].isDead && extra(seatedPlayers[i], i));
};

/* ------------------------------------------------------------------ *
 * Policy peek — the president sees the top three policies
 * ------------------------------------------------------------------ */

export function policyPeek(game: Game): void {
  const { presidentIndex, president } = presidentOf(game);
  if (game.private.lock.policyPeek) return;
  game.private.lock.policyPeek = true;

  if (game.gameState.undrawnPolicyCount < 3) shufflePolicies(game);

  game.general.status = `${T.president} باید نگاهی به قوانین بیندازد.`;
  game.publicPlayersState[presidentIndex].isLoader = true;
  president.playersState[presidentIndex].policyNotification = true;
  sendInProgressGameUpdate(game, true);
}

export function selectPolicies(caller: Caller, game: Game): void {
  const { presidentIndex, president } = presidentOf(game);

  if (game.gameState.isGameFrozen || game.general.isRemade) return;
  if (!president || president.userName !== caller.username) return;

  clearTimer(game);

  if (game.private.lock.selectPolicies) return;
  game.private.lock.selectPolicies = true;
  game.publicPlayersState[presidentIndex].isLoader = false;

  if (game.private.policies.length < 3) shufflePolicies(game);

  const top = game.private.policies.slice(0, 3);
  game.private.summary.updateLog({ policyPeek: top });

  president.cardFlingerState = threeCards(top);

  game.gameState.audioCue = 'policyPeek';
  president.playersState[presidentIndex].policyNotification = false;
  sendInProgressGameUpdate(game, true);

  setTimeout(() => {
    setFlipped(president.cardFlingerState as CardFlinger[], true);
    sendInProgressGameUpdate(game, true);
  }, pace(game, 2000, 500));

  setTimeout(() => {
    const cards = president.cardFlingerState as CardFlinger[];
    setFlipped(cards, false);
    for (const card of cards) card.action = '';
    sendInProgressGameUpdate(game, true);
    game.gameState.audioCue = '';
  }, pace(game, 6000, 3500));

  setTimeout(() => {
    president.cardFlingerState = [];

    const modLine = line(
      `${T.president} `,
      namedSeatTag(game, presidentIndex),
      ' نگاه کرد و دید: ',
      ...game.private.policies.slice(0, 3).map(policyLetter),
      '.'
    );
    game.private.hiddenInfoChat.push(modLine);
    sendInProgressModChatUpdate(game, modLine);

    if (!game.general.disableGamechat) {
      const [a, b, c] = top;
      president.gameChats.push(
        line('شما سه قانون رویی را دیدید: ', policyLabel(a), '، ', policyLabel(b), ' و ', policyLabel(c), '.')
      );
    }

    sendInProgressGameUpdate(game);
    game.trackState.electionTrackerCount = 0;
    president.playersState[presidentIndex].claim = 'didPolicyPeek';
    startElection(game);
  }, pace(game, 7000, 4500));

}

/* ------------------------------------------------------------------ *
 * Policy peek and drop — the president sees the top policy, may burn it
 * ------------------------------------------------------------------ */

export function policyPeekAndDrop(game: Game): void {
  const { presidentIndex, president } = presidentOf(game);
  if (game.private.lock.policyPeekAndDrop) return;
  game.private.lock.policyPeekAndDrop = true;

  if (game.gameState.undrawnPolicyCount < 3) shufflePolicies(game);

  game.general.status = `${T.president} باید نگاهی به یک قانون بیندازد.`;
  game.publicPlayersState[presidentIndex].isLoader = true;
  president.playersState[presidentIndex].policyNotification = true;
  sendInProgressGameUpdate(game, true);
}

export function selectOnePolicy(caller: Caller, game: Game, socket?: MaybeSocket): void {
  const { presidentIndex, president } = presidentOf(game);

  if (blocked(game, socket)) return;
  if (!president || president.userName !== caller.username) return;

  clearTimer(game);

  if (game.private.lock.selectOnePolicy) return;
  game.private.lock.selectOnePolicy = true;
  game.publicPlayersState[presidentIndex].isLoader = false;

  if (game.private.policies.length < 3) shufflePolicies(game);

  game.private.summary.updateLog({ policyPeek: game.private.policies.slice(0, 1) });

  const policy = game.private.policies[0];
  president.cardFlingerState = [
    { position: 'middle-center', action: 'active', cardStatus: { isFlipped: false, cardFront: 'policy', cardBack: `${policy}p` } },
  ];

  game.gameState.audioCue = 'policyPeek';
  president.playersState[presidentIndex].policyNotification = false;
  sendInProgressGameUpdate(game, true);

  setTimeout(() => {
    (president.cardFlingerState as CardFlinger[])[0].cardStatus.isFlipped = true;
    sendInProgressGameUpdate(game, true);
  }, pace(game, 2000, 500));

  setTimeout(() => {
    const [card] = president.cardFlingerState as CardFlinger[];
    card.cardStatus.isFlipped = false;
    card.action = '';
    sendInProgressGameUpdate(game, true);
    game.gameState.audioCue = '';
  }, pace(game, 6000, 3500));

  setTimeout(() => {
    president.cardFlingerState = [];

    const modLine = line(`${T.president} `, namedSeatTag(game, presidentIndex), ' نگاه کرد و دید: ', policyLetter(game.private.policies[0]), '.');
    game.private.hiddenInfoChat.push(modLine);
    sendInProgressModChatUpdate(game, modLine);

    if (!game.general.disableGamechat) {
      president.gameChats.push(line('شما قانون رویی را دیدید: ', policyLabel(policy), '.'));
    }

    sendInProgressGameUpdate(game);
    game.trackState.electionTrackerCount = 0;
    president.playersState[presidentIndex].claim = 'didSinglePolicyPeek';

    setTimeout(() => {
      game.publicPlayersState[presidentIndex].isLoader = true;
      president.cardFlingerState = ballotCards().map((card) => ({ ...card, cardStatus: { ...card.cardStatus } }));

      if (!game.general.disableGamechat) {
        president.gameChats.push(
          line('شما باید رأی بدهید که این قانون دورریخته شود یا نه. «آری» یعنی دورریختن قانونِ دیده‌شده و «نه» یعنی برگرداندن آن روی دسته.')
        );
      }
      sendInProgressGameUpdate(game);

      setTimeout(() => {
        const cards = president.cardFlingerState as CardFlinger[];
        setFlipped(cards, true);
        cards[0].notificationStatus = cards[1].notificationStatus = 'notification';
        game.gameState.phase = 'presidentVoteOnBurn';

        if (game.general.timedMode) {
          if (game.private.timerId) {
            clearTimeout(game.private.timerId);
            game.private.timerId = null;
          }
          game.gameState.timedModeEnabled = true;
          game.private.timerId = setTimeout(() => {
            if (!game.gameState.timedModeEnabled) return;
            game.gameState.timedModeEnabled = false;
            selectBurnCard({ username: president.userName }, game, { vote: Math.random() < 0.5 });
            game.private.replayGameChats.push(
              line(typed('player', president.userName), ' توسط زمان‌سنج مجبور شد به‌صورت تصادفی تعیین کند قانون رویی دور ریخته شود یا نه.')
            );
          }, timedModeMs(game));
        }

        sendInProgressGameUpdate(game);
      }, pace(game, 1000, 500));
    }, pace(game, 2000, 1000));
  }, pace(game, 7000, 4500));
}

export function selectBurnCard(caller: Caller, game: Game, data: { vote: boolean }, socket?: MaybeSocket): void {
  if (game.general.timedMode && game.private.timerId) {
    clearTimeout(game.private.timerId);
    game.private.timerId = null;
  }

  if (blocked(game, socket)) return;

  const { presidentIndex, president } = presidentOf(game);
  const publicPresident = game.publicPlayersState[presidentIndex];

  if (!president || president.userName !== caller.username) return;
  if (game.gameState.phase !== 'presidentVoteOnBurn') return;
  if (game.private.lock.selectBurnCard) return;
  game.private.lock.selectBurnCard = true;

  game.private.summary.updateLog({ presidentVeto: data.vote });
  publicPresident.isLoader = false;

  const cards = president.cardFlingerState as CardFlinger[];
  cards[0].action = cards[1].action = '';
  setFlipped(cards, false);
  cards[0].notificationStatus = data.vote ? 'selected' : '';
  cards[1].notificationStatus = data.vote ? '' : 'selected';

  publicPresident.cardStatus = { cardDisplayed: true, cardFront: 'ballot', cardBack: { cardName: data.vote ? 'ja' : 'nein' } };

  sendInProgressGameUpdate(game);

  setTimeout(() => {
    tellAllUnlessSilent(
      game,
      line(
        `${T.president} `,
        seatTag(game, game.private.seatedPlayers.indexOf(president)),
        data.vote ? ' تصمیم گرفت قانون رویی را دور بیندازد.' : ' تصمیم گرفت قانون رویی را نگه دارد.'
      )
    );

    publicPresident.cardStatus.isFlipped = true;
    president.cardFlingerState = [];
    if (data.vote) {
      game.private.policies.shift();
      game.gameState.undrawnPolicyCount--;
      if (game.gameState.undrawnPolicyCount < 3) shufflePolicies(game);
    }
    sendInProgressGameUpdate(game);

    setTimeout(() => startElection(game), pace(game, 3000, 1000));
  }, pace(game, 3000, 1000));
}

/* ------------------------------------------------------------------ *
 * Investigate loyalty
 * ------------------------------------------------------------------ */

export function investigateLoyalty(game: Game): void {
  const { presidentIndex, president } = presidentOf(game);

  const targets = livingOthers(game, (player) => !player.wasInvestigated);
  if (!targets.length) {
    tellAll(game, line(`${T.president} `, seatTag(game, presidentIndex), ' هدف معتبری برای بررسی ندارد.'));
    startElection(game);
    return;
  }

  if (game.private.lock.investigateLoyalty) return;
  game.private.lock.investigateLoyalty = true;

  game.general.status = `منتظر بررسی توسط ${T.president}.`;
  for (const i of targets) president.playersState[i].notificationStatus = 'notification';
  game.publicPlayersState[presidentIndex].isLoader = true;
  game.gameState.clickActionInfo = [president.userName, targets];
  game.gameState.phase = 'selectPartyMembershipInvestigate';
  sendInProgressGameUpdate(game, true);
}

export function selectPartyMembershipInvestigate(caller: Caller, game: Game, data: { playerIndex: number }, socket?: MaybeSocket): void {
  clearTimer(game);
  if (blocked(game, socket)) return;

  const { playerIndex } = data;
  const { presidentIndex, president, seatedPlayers } = presidentOf(game);
  const target = seatedPlayers[playerIndex];
  if (!target) return;
  const playersTeam = target.role.team;

  if (playerIndex === presidentIndex) return;
  if (!president || president.userName !== caller.username) return;
  if (game.gameState.phase !== 'selectPartyMembershipInvestigate') return;
  if (game.private.lock.selectPartyMembershipInvestigate) return;
  game.private.lock.selectPartyMembershipInvestigate = true;

  if (target.isDead || target.wasInvestigated) return;

  game.gameState.audioCue = 'selectedInvestigate';
  target.wasInvestigated = true;

  for (const state of president.playersState) state.notificationStatus = '';

  game.private.summary.updateLog({ investigationId: playerIndex, investigatorId: presidentIndex });

  game.publicPlayersState[presidentIndex].isLoader = false;
  game.publicPlayersState[playerIndex].cardStatus = { cardDisplayed: true, cardFront: 'partymembership', cardBack: {} };

  sendInProgressGameUpdate(game, true);

  setTimeout(() => {
    president.playersState[playerIndex].cardStatus = { isFlipped: true, cardBack: { cardName: `membership-${playersTeam}` } };

    if (!game.general.disableGamechat) {
      const announce = line(
        `${T.president} `,
        seatTag(game, presidentIndex),
        ' عضویت حزبی ',
        seatTag(game, playerIndex),
        ' را بررسی می‌کند.'
      );
      tellOthers(game, announce, president);

      president.gameChats.push(
        line('شما عضویت حزبی ', seatTag(game, playerIndex), ' را بررسی کردید و فهمیدید در ', 'تیم ', typed(playersTeam, teamName(playersTeam)), ' است.')
      );
    }

    const modLine = line(`${T.president} `, namedSeatTag(game, presidentIndex), ' کارت وفاداریِ ', typed(playersTeam, teamName(playersTeam)), ' را می‌بیند.');
    game.private.hiddenInfoChat.push(modLine);
    sendInProgressModChatUpdate(game, modLine);

    // A fascist who is not the monarchist and finds Hitler already knew them.
    if (!game.general.disableGamechat && !(target.role.cardName === 'hitler' && president.role.team === 'fascist' && president.role.cardName !== 'monarchist')) {
      president.playersState[playerIndex].nameStatus = playersTeam;
    }
    game.private.invIndex = playerIndex;
    sendInProgressGameUpdate(game);
  }, pace(game, 2000, 200));

  setTimeout(() => {
    game.gameState.audioCue = '';
    president.playersState[playerIndex].cardStatus.isFlipped = false;
    sendInProgressGameUpdate(game, true);
  }, pace(game, 6000, 4000));

  setTimeout(() => {
    game.publicPlayersState[playerIndex].cardStatus.cardDisplayed = false;
    president.playersState[playerIndex].cardStatus.cardBack = {};
    president.playersState[presidentIndex].claim = 'didInvestigateLoyalty';
    sendInProgressGameUpdate(game, true);
    startElection(game);
  }, pace(game, 8000, 4200));
}

/* ------------------------------------------------------------------ *
 * Show party membership (Avalon-style reverse investigation)
 * ------------------------------------------------------------------ */

export function showPlayerLoyalty(game: Game): void {
  const { presidentIndex, president } = presidentOf(game);
  if (game.private.lock.showPlayerLoyalty) return;
  game.private.lock.showPlayerLoyalty = true;

  const targets = livingOthers(game);
  game.general.status = `منتظر نشان دادن حزب توسط ${T.president}.`;
  for (const i of targets) president.playersState[i].notificationStatus = 'notification';
  game.publicPlayersState[presidentIndex].isLoader = true;
  game.gameState.clickActionInfo = [president.userName, targets];
  game.gameState.phase = 'selectPartyMembershipInvestigateReverse';
  sendInProgressGameUpdate(game, true);
}

export function selectPartyMembershipInvestigateReverse(caller: Caller, game: Game, data: { playerIndex: number }, socket?: MaybeSocket): void {
  clearTimer(game);
  if (blocked(game, socket)) return;

  const { playerIndex } = data;
  const { presidentIndex, president, seatedPlayers } = presidentOf(game);
  const playersTeam = seatedPlayers[presidentIndex].role.team;

  if (playerIndex === presidentIndex) return;
  const targetPlayer = seatedPlayers[playerIndex];
  if (!targetPlayer) return;
  if (!president || president.userName !== caller.username) return;
  if (game.gameState.phase !== 'selectPartyMembershipInvestigateReverse') return;
  if (game.private.lock.selectPartyMembershipInvestigateReverse) return;
  game.private.lock.selectPartyMembershipInvestigateReverse = true;

  if (targetPlayer.isDead) return;

  game.gameState.audioCue = 'selectedInvestigate';
  seatedPlayers[presidentIndex].wasInvestigated = true;

  for (const state of president.playersState) state.notificationStatus = '';

  game.private.summary.updateLog({ investigationId: presidentIndex, investigatorId: playerIndex });

  game.publicPlayersState[presidentIndex].isLoader = false;
  game.publicPlayersState[presidentIndex].cardStatus = { cardDisplayed: true, cardFront: 'partymembership', cardBack: {} };

  sendInProgressGameUpdate(game, true);

  setTimeout(() => {
    targetPlayer.playersState[presidentIndex].cardStatus = { isFlipped: true, cardBack: { cardName: `membership-${playersTeam}` } };

    if (!game.general.disableGamechat) {
      tellOthers(
        game,
        line(`${T.president} `, seatTag(game, presidentIndex), ' عضویت حزبی خود را به ', seatTag(game, playerIndex), ' نشان می‌دهد.'),
        president,
        targetPlayer
      );

      president.gameChats.push(line('شما کارت عضویت حزبی‌تان را به ', seatTag(game, playerIndex), ' نشان دادید.'));
      targetPlayer.gameChats.push(
        line(seatTag(game, presidentIndex), ' عضویت حزبی‌اش را به شما نشان داد و فهمیدید در تیم ', typed(playersTeam, teamName(playersTeam)), ' است.')
      );
    }

    const modLine = line(`${T.president} `, namedSeatTag(game, presidentIndex), ' کارت وفاداریِ ', typed(playersTeam, teamName(playersTeam)), ' خود را نشان می‌دهد.');
    game.private.hiddenInfoChat.push(modLine);
    sendInProgressModChatUpdate(game, modLine);

    if (
      !game.general.disableGamechat &&
      !(seatedPlayers[presidentIndex].role.cardName === 'hitler' && targetPlayer.role.team === 'fascist')
    ) {
      targetPlayer.playersState[presidentIndex].nameStatus = playersTeam;
    }

    game.private.invIndex = presidentIndex;
    sendInProgressGameUpdate(game);
  }, pace(game, 2000, 200));

  setTimeout(() => {
    game.gameState.audioCue = '';
    targetPlayer.playersState[presidentIndex].cardStatus.isFlipped = false;
    sendInProgressGameUpdate(game, true);
  }, pace(game, 6000, 4000));

  setTimeout(() => {
    game.publicPlayersState[presidentIndex].cardStatus.cardDisplayed = false;
    targetPlayer.playersState[presidentIndex].cardStatus.cardBack = {};
    targetPlayer.playersState[playerIndex].claim = 'didInvestigateLoyalty';
    sendInProgressGameUpdate(game, true);
    startElection(game);
  }, pace(game, 8000, 4200));
}

/* ------------------------------------------------------------------ *
 * Special election
 * ------------------------------------------------------------------ */

export function specialElection(game: Game): void {
  const { presidentIndex, president } = presidentOf(game);
  if (game.private.lock.specialElection) return;
  game.private.lock.specialElection = true;

  game.general.status = `${T.president} باید ${T.specialElection} را مشخص کند.`;
  game.gameState.specialElectionFormerPresidentIndex = presidentIndex;
  game.publicPlayersState[presidentIndex].isLoader = true;

  const targets = livingOthers(game);
  for (const i of targets) president.playersState[i].notificationStatus = 'notification';

  game.gameState.phase = 'specialElection';
  game.gameState.clickActionInfo = [president.userName, targets];
  sendInProgressGameUpdate(game, true);
}

export function selectSpecialElection(caller: Caller, game: Game, data: { playerIndex: number }, socket?: MaybeSocket): void {
  const { playerIndex } = data;
  const { presidentIndex, president, seatedPlayers } = presidentOf(game);

  if (!president || president.userName !== caller.username) return;
  if (blocked(game, socket)) return;
  if (playerIndex === presidentIndex) return;
  if (!seatedPlayers[playerIndex]) return;
  if (game.gameState.phase !== 'specialElection') return;

  clearTimer(game);

  if (game.private.lock.selectSpecialElection) return;
  game.private.lock.selectSpecialElection = true;

  game.private.summary.updateLog({ specialElection: playerIndex });
  game.publicPlayersState[presidentIndex].isLoader = false;
  for (const state of seatedPlayers[presidentIndex].playersState) state.notificationStatus = '';

  if (!game.general.disableGamechat) {
    tellOthers(
      game,
      line(`${T.president} `, seatTag(game, presidentIndex), ' تصمیم گرفته ', seatTag(game, playerIndex), ` را به‌عنوان ${T.president} برگزیند.`),
      president
    );
    president.gameChats.push(line('شما ', seatTag(game, playerIndex), ` را به‌عنوان ${T.president} برگزیدید.`));
  }

  sendInProgressGameUpdate(game);
  startElection(game, playerIndex);
}

/* ------------------------------------------------------------------ *
 * Execution
 * ------------------------------------------------------------------ */

export function executePlayer(game: Game): void {
  const { presidentIndex, president } = presidentOf(game);
  if (game.private.lock.executePlayer) return;
  game.private.lock.executePlayer = true;

  game.general.status = `${T.president} باید بازیکنی را اعدام کند.`;
  game.publicPlayersState[presidentIndex].isLoader = true;

  if (!game.general.disableGamechat) {
    president.gameChats.push(line('شما باید بازیکنی را برای اعدام انتخاب کنید.'));
  }

  // The legacy list filter was a tautology: every living seat is clickable;
  // an illegal shot (a fascist at Hitler) is refused when it is made.
  const targets = livingOthers(game);
  for (const i of targets) president.playersState[i].notificationStatus = 'notification';

  game.gameState.clickActionInfo = [president.userName, targets];
  game.gameState.phase = 'execution';
  sendInProgressGameUpdate(game);
}

export function selectPlayerToExecute(caller: Caller, game: Game, data: { playerIndex: number }, socket?: MaybeSocket): void {
  const { playerIndex } = data;
  const { presidentIndex, president, seatedPlayers } = presidentOf(game);
  const selectedPlayer = seatedPlayers[playerIndex];
  const publicSelectedPlayer = game.publicPlayersState[playerIndex];

  if (blocked(game, socket)) return;

  // The target must be a legal one.
  if (
    playerIndex === presidentIndex ||
    !selectedPlayer ||
    selectedPlayer.isDead ||
    (!game.customGameSettings.fasCanShootHit && president.role.cardName === 'fascist' && selectedPlayer.role.cardName === 'hitler')
  ) {
    return;
  }

  if (!president || president.userName !== caller.username) return;
  if (game.gameState.phase !== 'execution') return;

  clearTimer(game);

  if (game.private.lock.selectPlayerToExecute) return;

  game.gameState.audioCue = 'selectedExecution';
  game.private.lock.selectPlayerToExecute = true;

  game.private.summary.updateLog({ execution: playerIndex });

  if (!game.general.disableGamechat) {
    tellOthers(game, line(`${T.president} `, seatTag(game, presidentIndex), ' تصمیم می‌گیرد ', seatTag(game, playerIndex), ' را اعدام کند.'), president);
    president.gameChats.push(line('شما تصمیم گرفتید ', seatTag(game, playerIndex), ' را اعدام کنید.'));
  }

  game.publicPlayersState[presidentIndex].isLoader = false;
  for (const state of president.playersState) state.notificationStatus = '';

  if (game.general.avalonSH && selectedPlayer.role.cardName === 'hitler') {
    assassinateMerlin(game);
    return;
  }

  publicSelectedPlayer.cardStatus.cardDisplayed = true;
  publicSelectedPlayer.cardStatus.cardFront = 'secretrole';
  publicSelectedPlayer.notificationStatus = 'danger';
  publicSelectedPlayer.isDead = true;
  sendInProgressGameUpdate(game);

  setTimeout(() => {
    game.gameState.audioCue = '';
    selectedPlayer.isDead = publicSelectedPlayer.isDead = true;
    publicSelectedPlayer.notificationStatus = '';
    game.general.livingPlayerCount--;
    sendInProgressGameUpdate(game, true);

    const revealAndFinish = (winner: 'liberal' | 'fascist') => {
      publicSelectedPlayer.cardStatus.cardBack = selectedPlayer.role;
      publicSelectedPlayer.cardStatus.isFlipped = true;

      setTimeout(() => {
        game.publicPlayersState.forEach((player, i) => {
          player.cardStatus.cardFront = 'secretrole';
          player.cardStatus.cardDisplayed = true;
          player.cardStatus.cardBack = seatedPlayers[i].role;
        });
        game.gameState.audioCue = 'hitlerShot';
        sendInProgressGameUpdate(game);
      }, fast(1000));

      setTimeout(() => {
        for (const player of game.publicPlayersState) player.cardStatus.isFlipped = true;
        game.gameState.audioCue = '';
        completeGame(game, winner);
      }, fast(2000));
    };

    if (selectedPlayer.role.cardName === 'hitler') {
      const hitlerLine = line(typed('hitler', T.hitler), ' اعدام شد.');
      if (game.general.monarchistSH) {
        hitlerLine.chat.push(
          { text: ' در نتیجه ' },
          typed('monarchist', T.monarchist),
          { text: ' همراه ' },
          typed('liberal', T.liberals),
          { text: ' برنده شده است.' }
        );
      }
      tellAll(game, hitlerLine);
      revealAndFinish('liberal');
      return;
    }

    const liberalAlive = seatedPlayers.some((player) => player.role.team === 'liberal' && !player.isDead);
    if (!liberalAlive) {
      tellAll(game, line('همه‌ی ', typed('liberal', T.liberals), ' اعدام شدند.'));
      revealAndFinish('fascist');
      return;
    }

    const playersAlive = seatedPlayers.filter((player) => !player.isDead).length;
    if (playersAlive <= 2) {
      tellAll(game, line(typed('hitler', T.hitler), ' و یک ', typed('liberal', T.liberal), ' باقی مانده‌اند؛ بازی با تاپ‌دک تا آخر ادامه می‌یابد…'));
      game.general.status = 'تاپ‌دک تا پایان…';
      sendInProgressGameUpdate(game);
      topdeckToTheEnd(game);
      return;
    }

    publicSelectedPlayer.cardStatus.cardDisplayed = false;
    sendInProgressGameUpdate(game, true);
    setTimeout(() => {
      game.trackState.electionTrackerCount = 0;
      startElection(game);
    }, fast(2000));
  }, fast(4000));
}

/** Hitler and one liberal remain: policies are enacted from the deck until someone wins. */
function topdeckToTheEnd(game: Game): void {
  const playCard = () => {
    const { noTopdecking } = game.general;
    if (noTopdecking === 1 || (noTopdecking === 2 && (game.trackState.consecutiveTopdecks ?? 0) >= 1)) {
      game.chats.push(line('بازی با «تاپ‌دک» تمام شد.'));
      game.publicPlayersState.forEach((player, i) => {
        player.cardStatus.cardFront = 'secretrole';
        player.cardStatus.cardBack = game.private.seatedPlayers[i].role;
        player.cardStatus.cardDisplayed = true;
        player.cardStatus.isFlipped = false;
      });
      game.gameState.audioCue = 'fascistsWin';
      sendInProgressGameUpdate(game, true);

      setTimeout(() => {
        for (const player of game.publicPlayersState) player.cardStatus.isFlipped = true;
        game.gameState.audioCue = '';
        completeGame(game, 'fascist');
      }, 2000);
      return;
    }
    if (noTopdecking === 2) game.trackState.consecutiveTopdecks = (game.trackState.consecutiveTopdecks ?? 0) + 1;

    if (game.private.policies.length < 3) shufflePolicies(game);
    const index = game.trackState.enactedPolicies.length;
    const policy = game.private.policies.shift() as PolicyName;
    if (policy === 'liberal') game.trackState.liberalPolicyCount++;
    else game.trackState.fascistPolicyCount++;
    sendGameList();
    game.trackState.enactedPolicies.push({ position: 'middle', cardBack: policy, isFlipped: false });
    game.trackState.enactedPolicies[index].isFlipped = true;
    const count = policy === 'liberal' ? game.trackState.liberalPolicyCount : game.trackState.fascistPolicyCount;
    game.trackState.enactedPolicies[index].position = `${policy}${count}`;

    tellAllUnlessSilent(
      game,
      line('یک ', typed(policy, policy === 'liberal' ? T.liberalPolicy : T.fascistPolicy), ` تصویب شد. (${count}/${policy === 'liberal' ? 5 : 6})`)
    );

    if (game.general.avalonSH && game.trackState.liberalPolicyCount === 5) {
      assassinateMerlin(game);
    } else if (game.trackState.liberalPolicyCount === 5 || game.trackState.fascistPolicyCount === 6) {
      game.publicPlayersState.forEach((player, i) => {
        player.cardStatus.cardFront = 'secretrole';
        player.cardStatus.cardBack = game.private.seatedPlayers[i].role;
        player.cardStatus.cardDisplayed = true;
        player.cardStatus.isFlipped = false;
      });
      game.gameState.audioCue = game.trackState.liberalPolicyCount === 5 ? 'liberalsWin' : 'fascistsWin';
      setTimeout(() => {
        for (const player of game.publicPlayersState) player.cardStatus.isFlipped = true;
        game.gameState.audioCue = '';
        completeGame(game, game.trackState.liberalPolicyCount === 5 ? 'liberal' : 'fascist');
      }, fast(2000));
    } else {
      setTimeout(playCard, 2500);
    }
    sendInProgressGameUpdate(game);
  };
  setTimeout(playCard, 2500);
}

