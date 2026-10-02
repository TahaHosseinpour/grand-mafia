import { T } from '@/lib/glossary';
import { line, tellAll, tellOthers, typed } from './chat';
import { FROZEN_MESSAGE, REMADE_MESSAGE } from './election-util';
import { completeGame } from './end-game';
import { sendInProgressGameUpdate } from './updates';
import type { HubSocket } from './hub';
import type { Caller, Game } from './types';

/**
 * Avalon mode: once the liberals would win (five policies, or Hitler shot),
 * Hitler gets one guess at who Merlin is. A right guess turns the game.
 */
export function assassinateMerlin(game: Game): void {
  const { seatedPlayers } = game.private;
  const hitlerIndex = seatedPlayers.findIndex((player) => player.role.cardName === 'hitler');
  const hitler = seatedPlayers[hitlerIndex];

  if (game.private.lock.assassinateMerlin || !game.general.avalonSH) return;
  game.private.lock.assassinateMerlin = true;

  game.general.status = `${T.hitler} باید یک نفر را برای ترور انتخاب کند.`;
  for (const player of game.publicPlayersState) {
    player.cardStatus.cardDisplayed = false;
    player.cardStatus.cardFront = '';
  }
  game.publicPlayersState[hitlerIndex].cardStatus.cardDisplayed = true;
  game.publicPlayersState[hitlerIndex].cardStatus.cardFront = 'secretrole';
  sendInProgressGameUpdate(game);

  setTimeout(() => {
    game.publicPlayersState[hitlerIndex].cardStatus.cardBack = hitler.role;
    game.publicPlayersState[hitlerIndex].cardStatus.isFlipped = true;
    game.publicPlayersState[hitlerIndex].isLoader = true;

    for (const player of game.publicPlayersState) player.isDead = false;

    if (!game.general.disableGamechat) {
      hitler.gameChats.push(line('شما باید یک نفر را برای ترور انتخاب کنید.'));
      tellOthers(game, line(`${T.hitler} اکنون باید بازیکنی را برای ترور انتخاب کند.`), hitler);
    }

    hitler.playersState.forEach((state, index) => {
      const role = seatedPlayers[index].role;
      if (role.cardName === 'fascist') state.nameStatus = 'fascist';
      if (role.cardName === 'morgana') state.nameStatus = 'morgana';
      if (role.team === 'liberal') state.notificationStatus = 'notification';
    });

    game.gameState.clickActionInfo = [
      hitler.userName,
      seatedPlayers.map((_, index) => index).filter((index) => seatedPlayers[index].role.team === 'liberal'),
    ];
    game.gameState.phase = 'assassination';
    sendInProgressGameUpdate(game);
  }, 2000);
}

export function selectPlayerToAssassinate(caller: Caller, game: Game, data: { playerIndex: number }, socket?: HubSocket | null): void {
  const { seatedPlayers } = game.private;
  const target = seatedPlayers[data.playerIndex];
  if (!target) return;
  const publicTarget = game.publicPlayersState[data.playerIndex];
  const merlinIndex = seatedPlayers.findIndex((player) => player.role.cardName === 'merlin');
  const merlin = seatedPlayers[merlinIndex];
  const winningTeam = target.role.cardName === 'merlin' ? 'fascist' : 'liberal';
  const hitlerIndex = seatedPlayers.findIndex((player) => player.role.cardName === 'hitler');

  if (game.gameState.isGameFrozen) {
    socket?.emit('sendAlert', FROZEN_MESSAGE);
    return;
  }
  if (game.general.isRemade) {
    socket?.emit('sendAlert', REMADE_MESSAGE);
    return;
  }

  if (game.publicPlayersState[hitlerIndex].userName !== caller.username) return;
  if (target.role.team !== 'liberal') return;
  if (!game.general.avalonSH || game.gameState.phase !== 'assassination') return;

  game.private.summary.updateLog({ assassination: data.playerIndex });

  game.publicPlayersState[hitlerIndex].isLoader = false;
  (game.gameState.clickActionInfo as [string, number[]])[1] = [];

  for (const state of seatedPlayers[hitlerIndex].playersState) state.notificationStatus = '';

  publicTarget.cardStatus.cardFront = 'secretrole';
  publicTarget.cardStatus.cardBack = target.role;
  publicTarget.cardStatus.cardDisplayed = true;
  publicTarget.cardStatus.isFlipped = false;

  sendInProgressGameUpdate(game, true);

  setTimeout(() => {
    publicTarget.cardStatus.isFlipped = true;
    game.gameState.audioCue = `${winningTeam}sWin`;

    const targetTag = typed('player', `${target.userName} {${data.playerIndex + 1}}`);
    const result =
      winningTeam === 'fascist'
        ? line(typed('hitler', T.hitler), ' تصمیم می‌گیرد ', targetTag, ' را ترور کند، و او ', typed('merlin', T.merlin), ' بود.')
        : line(
            typed('hitler', T.hitler),
            ' تصمیم می‌گیرد ',
            targetTag,
            ' را ترور کند، اما ',
            typed('player', `${merlin.userName} {${merlinIndex + 1}}`),
            ' ',
            typed('merlin', T.merlin),
            ' بود.'
          );
    tellAll(game, result);

    sendInProgressGameUpdate(game);
  }, 1000);

  setTimeout(() => {
    game.publicPlayersState.forEach((player, i) => {
      if (i !== data.playerIndex && i !== hitlerIndex) {
        player.cardStatus.cardFront = 'secretrole';
        player.cardStatus.cardBack = game.private.seatedPlayers[i].role;
        player.cardStatus.cardDisplayed = true;
        player.cardStatus.isFlipped = false;
      }
    });
    sendInProgressGameUpdate(game, true);
  }, 2000);

  setTimeout(() => {
    for (const player of game.publicPlayersState) player.cardStatus.isFlipped = true;
    game.gameState.audioCue = '';
    completeGame(game, winningTeam);
  }, 3000);
}
