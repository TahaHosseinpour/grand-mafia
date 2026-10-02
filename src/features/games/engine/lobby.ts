import { formatNumber } from '@/lib/datetime';
import { pickBlindNames } from './blind-names';
import { sendGameList, sendUserList, updateUserStatus } from './lists';
import { range } from './shuffle';
import { saveAndDeleteGame } from './persist';
import { startGame } from './start-game';
import { engineStore } from './store';
import { sendCommandChatsUpdate, sendInProgressGameUpdate } from './updates';
import { line } from './chat';
import type { HubSocket } from './hub';
import type { Caller, Game } from './types';

/**
 * The waiting room: counting down to the start as seats fill, dropping out of
 * it as they empty, and leaving a game (legacy `leave-game.js`).
 */

/** «منتظر ۲ بازیکن دیگر…» — how many more seats until the next legal player count. */
function waitingText(game: Game): string | undefined {
  const included = range(game.general.minPlayersCount, game.general.maxPlayersCount + 1).filter(
    (count) => !game.general.excludedPlayerCount.includes(count)
  );
  for (const count of included) {
    if (count > game.publicPlayersState.length) {
      return `منتظر ${formatNumber(count - game.publicPlayersState.length)} بازیکن دیگر…`;
    }
  }
  return undefined;
}

function startCountdown(game: Game): void {
  if (game.gameState.isStarted) return;

  game.gameState.isStarted = true;
  let pause = 20;

  const countdown = setInterval(() => {
    if (game.gameState.cancellStart) {
      game.gameState.cancellStart = false;
      game.gameState.isStarted = false;
      clearInterval(countdown);
    } else if (pause === 4 || game.publicPlayersState.length === game.general.maxPlayersCount) {
      clearInterval(countdown);

      if (game.general.blindMode) {
        game.general.replacementNames = pickBlindNames(game.publicPlayersState.length);
      }
      game.remakeData = game.publicPlayersState.map((player) => ({
        userName: player.userName,
        isRemaking: false,
        timesVoted: 0,
        remakeTime: 0,
      }));
      startGame(game);
    } else {
      game.general.status = `بازی تا ${formatNumber(pause)} ثانیه‌ی دیگر شروع می‌شود.`;
      sendCommandChatsUpdate(game);
    }
    pause--;
  }, 1000);
}

/** Called whenever the seats change: starts, cancels or keeps waiting. */
export function checkStartConditions(game: Game): void {
  if (game.gameState.isTracksFlipped) return;

  const count = game.publicPlayersState.length;
  const legal = count >= game.general.minPlayersCount && !game.general.excludedPlayerCount.includes(count);

  if (game.gameState.isStarted && !legal) {
    game.gameState.cancellStart = true;
    game.general.status = waitingText(game) ?? game.general.status;
  } else if (!game.gameState.isStarted && legal) {
    game.remakeData = game.publicPlayersState.map((player) => ({
      userName: player.userName,
      isRemaking: false,
      timesVoted: 0,
      remakeTime: 0,
    }));
    startCountdown(game);
  } else if (!game.gameState.isStarted) {
    game.general.status = waitingText(game) ?? game.general.status;
  }
}

/** Votes needed to remake: all but the fascists in a custom game, else a majority plus two. */
export function minimumRemakeVotes(game: Game): number {
  const fascists = game.customGameSettings.fascistCount;
  return (fascists && game.general.playerCount - fascists) || Math.floor(game.general.playerCount / 2) + 2;
}

/** A player who leaves cancels their remake vote (and the countdown if it no longer has the votes). */
function rescindRemakeVoteOnLeave(game: Game, userName: string, minimum: number): void {
  const vote = game.remakeData?.find((player) => player.userName === userName);
  if (!vote?.isRemaking || !game.remakeData) return;

  const votes = game.remakeData.filter((player) => player.isRemaking).length;
  if (!game.general.isRemade && game.general.isRemaking && votes <= minimum) {
    game.general.isRemaking = false;
    game.general.status = 'ساخت دوباره‌ی بازی لغو شد.';
    clearInterval(game.private.remakeTimer);
  }
  game.chats.push(
    line(`یک بازیکن بازی را ترک کرد و رأی خود را برای ساخت دوباره‌ی بازی پس گرفت. (${formatNumber(votes - 1)}/${formatNumber(minimum)})`)
  );
  vote.isRemaking = false;
}

/** The player closed the page or lost their connection. */
export function handleSocketDisconnect(userName: string | null): void {
  if (!userName) return;
  const store = engineStore();
  let listUpdate = false;

  const userIndex = store.userList.findIndex((user) => user.userName === userName);
  if (userIndex !== -1) {
    store.userList.splice(userIndex, 1);
    listUpdate = true;
  }

  const seatedIn = [...store.games.values()].filter((game) =>
    game.publicPlayersState.some((player) => player.userName === userName && !player.leftGame)
  );

  for (const game of seatedIn) {
    const { gameState, publicPlayersState } = game;
    const playerIndex = publicPlayersState.findIndex((player) => player.userName === userName);

    const lastOneStanding =
      (!gameState.isStarted && publicPlayersState.length === 1) ||
      (gameState.isCompleted && publicPlayersState.filter((player) => !player.connected || player.leftGame).length === game.general.playerCount - 1);

    if (lastOneStanding) {
      void saveAndDeleteGame(game.general.uid);
    } else if (!gameState.isTracksFlipped && playerIndex > -1) {
      publicPlayersState.splice(playerIndex, 1);
      checkStartConditions(game);
      sendCommandChatsUpdate(game);
    } else if (gameState.isTracksFlipped) {
      publicPlayersState[playerIndex].connected = false;
      publicPlayersState[playerIndex].leftGame = true;
      rescindRemakeVoteOnLeave(game, userName, game.general.playerCount - (game.customGameSettings.fascistCount ?? 0));
      sendInProgressGameUpdate(game);
      if (game.publicPlayersState.filter((player) => player.leftGame).length === game.general.playerCount) {
        game.general.timeAbandoned = new Date();
      }
    }
  }

  if (seatedIn.length) {
    sendGameList();
    listUpdate = true;
  }
  if (listUpdate) sendUserList();
}

/** The player pressed «leave game» (or is remaking into a new table). */
export function handleUserLeaveGame(socket: HubSocket, game: Game, caller: Caller, data: { isRemake?: boolean }): void {
  const playerIndex = game.publicPlayersState.findIndex((player) => player.userName === caller.username);

  if (playerIndex > -1) {
    rescindRemakeVoteOnLeave(game, caller.username, minimumRemakeVotes(game));
    if (game.gameState.isTracksFlipped) game.publicPlayersState[playerIndex].leftGame = true;
    if (game.publicPlayersState.filter((player) => player.leftGame).length === game.general.playerCount) {
      game.general.timeAbandoned = new Date();
    }
    if (!game.gameState.isTracksFlipped) {
      game.publicPlayersState.splice(playerIndex, 1);
      checkStartConditions(game);
      sendCommandChatsUpdate(game);
    }
  }

  if (!game.publicPlayersState.length) {
    engineStore().hub.emitRoom(game.general.uid, 'gameUpdate', {});
    void saveAndDeleteGame(game.general.uid);
  } else if (game.gameState.isTracksFlipped) {
    sendInProgressGameUpdate(game);
  }

  if (!data.isRemake) {
    updateUserStatus(caller.username, null);
    socket.emit('gameUpdate', {});
  }
  sendGameList();
}
