import { formatNumber } from '@/lib/datetime';
import { T } from '@/lib/glossary';
import { line, seatTag } from './chat';
import { selectVoting } from './election';
import { pace, timedModeMs } from './timing';
import { sendInProgressGameUpdate } from './updates';
import type { HubSocket } from './hub';
import type { Caller, Game } from './types';

/** The two ballot cards (ja / nein) a player flings at a vote. */
export const ballotCards = () =>
  [
    { position: 'middle-left', notificationStatus: '', action: 'active', cardStatus: { isFlipped: false, cardFront: 'ballot', cardBack: 'ja' } },
    { position: 'middle-right', action: 'active', notificationStatus: '', cardStatus: { isFlipped: false, cardFront: 'ballot', cardBack: 'nein' } },
  ] as const;

/** Votes needed in a timed game before missing votes may be filled in at random. */
const NEEDED_PLAYERS: Record<number, number> = { 5: 4, 6: 5, 7: 5, 8: 6, 9: 6, 10: 7 };

export const FROZEN_MESSAGE = 'یکی از مدیران جلوی ادامه‌ی این بازی را گرفته است. لطفاً صبر کنید.';
export const REMADE_MESSAGE = 'این بازی دوباره ساخته شده و دیگر قابل بازی نیست.';

/**
 * The president nominates a chancellor and the vote opens.
 * @param socket the nominating player's socket (null when the timer picks)
 * @param force a moderator forced this action
 */
export function selectChancellor(
  socket: HubSocket | null,
  caller: Caller,
  game: Game,
  data: { chancellorIndex: number },
  force = false
): void {
  const { chancellorIndex } = data;
  if (!Number.isInteger(chancellorIndex) || chancellorIndex >= game.general.playerCount || chancellorIndex < 0) return;

  if (game.gameState.isGameFrozen && !force) {
    socket?.emit('sendAlert', FROZEN_MESSAGE);
    return;
  }

  const { presidentIndex } = game.gameState;
  const seatedPlayers = game.private.seatedPlayers.filter((player) => !player.isDead);
  const presidentPlayer = game.private.seatedPlayers[presidentIndex];

  // The pick must be legal: alive, not the president, not term-limited.
  if (
    game.publicPlayersState[chancellorIndex].isDead ||
    chancellorIndex === presidentIndex ||
    chancellorIndex === game.gameState.previousElectedGovernment[1] ||
    (chancellorIndex === game.gameState.previousElectedGovernment[0] && game.general.livingPlayerCount > 5)
  ) {
    return;
  }

  if (!presidentPlayer || presidentPlayer.userName !== caller.username) return;

  if (game.general.timedMode && game.private.timerId) {
    clearTimeout(game.private.timerId);
    game.private.timerId = null;
    game.gameState.timedModeEnabled = false;
  }

  if (
    game.private.lock.selectChancellor ||
    Number.isInteger(game.gameState.pendingChancellorIndex) ||
    game.gameState.phase === 'voting'
  ) {
    return;
  }

  game.private.lock.selectChancellor = true;
  game.publicPlayersState[presidentIndex].isLoader = false;
  game.private.summary.updateLog({ chancellorId: chancellorIndex });

  for (const state of presidentPlayer.playersState) state.notificationStatus = '';

  game.publicPlayersState[chancellorIndex].governmentStatus = 'isPendingChancellor';
  game.gameState.pendingChancellorIndex = chancellorIndex;
  game.general.status = `اکنون به انتخابات شماره‌ی ${formatNumber(game.general.electionCount)} رأی دهید.`;

  for (const player of game.publicPlayersState.filter((p) => !p.isDead)) {
    player.isLoader = true;
    player.cardStatus = { cardDisplayed: true, isFlipped: false, cardFront: 'ballot', cardBack: {} };
  }

  sendInProgressGameUpdate(game, true);

  for (const player of seatedPlayers) {
    if (!game.general.disableGamechat) {
      player.gameChats.push(
        line(
          `شما باید به انتخاب ${T.president} `,
          seatTag(game, presidentIndex),
          ` و ${T.chancellor} `,
          seatTag(game, chancellorIndex),
          ' رأی بدهید.'
        )
      );
    }
    player.cardFlingerState = ballotCards().map((card) => ({ ...card, cardStatus: { ...card.cardStatus } }));
  }

  game.private.unSeatedGameChats.push(
    line(`${T.president} `, seatTag(game, presidentIndex), ' ', seatTag(game, chancellorIndex), ` را به‌عنوان ${T.chancellor} معرفی می‌کند.`)
  );

  setTimeout(() => sendInProgressGameUpdate(game), pace(game, 1000, 500));

  game.gameState.phase = 'voting';

  setTimeout(() => {
    for (const player of seatedPlayers) {
      if (player.cardFlingerState?.length) {
        player.cardFlingerState[0].cardStatus.isFlipped = player.cardFlingerState[1].cardStatus.isFlipped = true;
        player.cardFlingerState[0].notificationStatus = player.cardFlingerState[1].notificationStatus = 'notification';
        player.voteStatus = { hasVoted: false };
      }
    }

    if (game.general.timedMode) {
      if (game.private.timerId) {
        clearTimeout(game.private.timerId);
        game.private.timerId = null;
      }
      game.gameState.timedModeEnabled = true;
      game.private.timerId = setTimeout(() => {
        const needed = NEEDED_PLAYERS[game.general.playerCount] ?? game.general.playerCount;
        const active = game.publicPlayersState.filter((player) => !player.leftGame || player.isDead).length;

        if (active < needed) {
          if (!game.general.disableGamechat) {
            for (const player of seatedPlayers) {
              player.gameChats.push(line('بازیکنان کافی حاضر نیستند؛ رأی‌های ثبت‌نشده به‌صورت خودکار انتخاب نمی‌شوند.'));
            }
            sendInProgressGameUpdate(game);
          }
          return;
        }

        if (!game.gameState.timedModeEnabled) return;
        const unvoted = game.private.seatedPlayers
          .filter((player) => !player.voteStatus?.hasVoted && !player.isDead)
          .map((player) => player.userName);

        game.gameState.timedModeEnabled = false;
        for (const userName of unvoted) {
          selectVoting({ username: userName }, game, { vote: Math.random() > 0.5 }, socket);
          game.private.replayGameChats.push(line({ text: userName, type: 'player' }, ' توسط زمان‌سنج مجبور شد یک رأی تصادفی بدهد.'));
        }
      }, timedModeMs(game));
    }
    sendInProgressGameUpdate(game);
  }, pace(game, 1500, 500));
}
