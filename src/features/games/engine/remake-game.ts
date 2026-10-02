import { formatNumber } from '@/lib/datetime';
import { remakeInput } from '../inputs';
import { chatReplacements } from './chat-replacements';
import { line, typed } from './chat';
import { handleSeatRequest } from './join-game';
import { checkStartConditions, minimumRemakeVotes } from './lobby';
import { sendGameList, findOnlineUser } from './lists';
import { saveAndDeleteGame } from './persist';
import { sendGameInfo } from './requests';
import { engineStore } from './store';
import { FROZEN_MESSAGE } from './election-util';
import { sendInProgressGameUpdate } from './updates';
import type { HubSocket } from './hub';
import type { Caller, Game, GameChatLine } from './types';

/**
 * Voting to remake a game: when enough players agree the table is replaced by
 * a fresh one with the same options, and those who voted are seated at it
 * (legacy `remake-game.js`).
 */

function remakeUid(uid: string): string {
  const base = uid.split('Remake')[0];
  const count = uid.includes('Remake') ? Number.parseInt(uid.split('Remake')[1], 10) + 1 : 1;
  return `${base}Remake${count}`;
}

function makeNewGame(game: Game): void {
  const store = engineStore();
  const remakeData = game.remakeData ?? [];

  if (store.flags.gameCreationDisabled) {
    game.chats.push(line(typed('hitler', 'بازسازی بازی لغو شد؛ ساخت بازی جدید در حال حاضر غیرفعال است.')));
    sendInProgressGameUpdate(game);
    return;
  }

  const remakers = remakeData.filter((player) => player.isRemaking).map((player) => player.userName);
  const remakerSockets = store.hub.allSockets().filter((socket) => socket.username && remakers.includes(socket.username));
  sendInProgressGameUpdate(game);

  const uid = remakeUid(game.general.uid);
  const general = structuredClone(game.general);
  Object.assign(general, {
    uid,
    isRemade: false,
    isRemaking: false,
    isRecorded: false,
    electionCount: 0,
    lastModPing: 0,
    chatReplTime: Array(chatReplacements.length + 1).fill(0),
    timeCreated: new Date(),
    timeStarted: undefined,
    timeAbandoned: undefined,
    playerCount: 0,
    livingPlayerCount: 0,
    replacementNames: undefined,
  });

  const newGame: Game = {
    general,
    gameState: { previousElectedGovernment: [], undrawnPolicyCount: 17, discardedPolicyCount: 0, presidentIndex: -1, isCompleted: false },
    trackState: { liberalPolicyCount: 0, fascistPolicyCount: 0, electionTrackerCount: 0, enactedPolicies: [] },
    customGameSettings: structuredClone(game.customGameSettings),
    chats: [],
    publicPlayersState: game.publicPlayersState
      .filter((player) => remakers.includes(player.userName))
      .map((player) => ({
        userName: player.userName,
        customCardback: player.customCardback,
        customCardbackUid: player.customCardbackUid,
        previousSeasonAward: player.previousSeasonAward,
        connected: player.connected,
        isRemakeVoting: false,
        pingTime: undefined,
        cardStatus: { cardDisplayed: false, isFlipped: false, cardFront: 'secretrole', cardBack: {} },
      })),
    remakeData: [],
    guesses: {},
    merlinGuesses: {},
    summarySaved: false,
    private: {
      reports: {},
      unSeatedGameChats: [],
      commandChats: {},
      replayGameChats: [],
      lock: {},
      votesPeeked: false,
      remakeVotesPeeked: false,
      invIndex: -1,
      privatePassword: game.private.privatePassword,
      hiddenInfoChat: [],
      hiddenInfoSubscriptions: [],
      hiddenInfoShouldNotify: true,
      gameCreatorName: game.private.gameCreatorName,
      gameCreatorBlacklist: game.private.gameCreatorBlacklist,
      seatedPlayers: [],
      policies: [],
      summary: undefined as never,
      voteSpamData: [],
      timerId: null,
      currentElectionPolicies: [],
      currentChancellorOptions: [],
    },
  };

  if (newGame.customGameSettings.enabled) {
    const deck = newGame.customGameSettings.deckState as { lib: number; fas: number };
    const track = newGame.customGameSettings.trackState as { lib: number; fas: number };
    newGame.chats.push(
      line('در دسته‌ی قوانین ', typed('liberal', `${formatNumber(deck.lib - track.lib)} لیبرال`), ' و ', typed('fascist', `${formatNumber(deck.fas - track.fas)} فاشیست`), ' خواهد بود.'),
      line('بازی با ', typed('liberal', `${formatNumber(track.lib)} قانون لیبرال`), ' و ', typed('fascist', `${formatNumber(track.fas)} قانون فاشیستی`), ' آغاز می‌شود.')
    );
  }

  // The old table shows everyone's role one last time.
  game.publicPlayersState.forEach((player, i) => {
    const seat = game.private.seatedPlayers[i];
    if (seat?.role) {
      player.cardStatus.cardFront = 'secretrole';
      player.cardStatus.cardBack = seat.role;
      player.cardStatus.cardDisplayed = true;
      player.cardStatus.isFlipped = true;
    }
  });

  game.general.status = 'بازی در حال ساخته شدن دوباره است…';
  sendInProgressGameUpdate(game);

  setTimeout(() => {
    for (const player of game.publicPlayersState) {
      if (remakers.includes(player.userName)) player.leftGame = true;
    }

    if (game.publicPlayersState.filter((player) => player.leftGame).length === game.general.playerCount) {
      void saveAndDeleteGame(game.general.uid);
    } else {
      sendInProgressGameUpdate(game);
    }

    store.games.set(uid, newGame);
    sendGameList();

    let creatorRemade = false;
    for (const socket of remakerSockets) {
      socket.leave(game.general.uid);
      sendGameInfo(socket, uid);
      if (socket.username) {
        void handleSeatRequest(socket, { username: socket.username }, { uid });
        if (socket.username === newGame.private.gameCreatorName) creatorRemade = true;
      }
    }

    // The creator's blacklist is re-read only if they remade; otherwise it no longer applies.
    if (creatorRemade && newGame.private.gameCreatorBlacklist != null) {
      const creator = findOnlineUser(newGame.private.gameCreatorName);
      if (creator) newGame.private.gameCreatorBlacklist = creator.blacklist;
    } else {
      newGame.private.gameCreatorBlacklist = null;
    }
    checkStartConditions(newGame);
  }, 3000);
}

/** A player votes to remake the game, or takes their vote back. */
export function handleUpdatedRemakeGame(caller: Caller, game: Game, raw: unknown, socket: HubSocket): void {
  const parsed = remakeInput.safeParse(raw);
  if (!parsed.success) return;
  const data = parsed.data;

  if (game.general.isRemade) return; // a game can only be remade once

  if (game.gameState.isGameFrozen) {
    socket.emit('sendAlert', FROZEN_MESSAGE);
    return;
  }

  const { remakeData, publicPlayersState } = game;
  if (!remakeData) return;
  const player = remakeData.find((vote) => vote.userName === caller.username);
  const seat = publicPlayersState.findIndex((p) => p.userName === caller.username);
  if (!player) return;

  const minimum = minimumRemakeVotes(game);
  const named = game.general.private && !game.general.privateAnonymousRemakes;
  const chat: GameChatLine = named
    ? line(typed('player', `${caller.username} {${seat + 1}} `))
    : line('یک بازیکن');

  if (data.remakeStatus && Date.now() > player.remakeTime + 7000) {
    player.isRemaking = true;
    player.timesVoted++;
    player.remakeTime = Date.now();

    const votes = remakeData.filter((vote) => vote.isRemaking).length;
    chat.chat.push({ text: ` رأی داد این بازی دوباره ساخته شود. (${formatNumber(votes)}/${formatNumber(minimum)})` });

    if (!game.general.isRemaking && publicPlayersState.length > 3 && votes >= minimum) {
      game.general.isRemaking = true;
      game.general.remakeCount = 5;

      game.private.remakeTimer = setInterval(() => {
        if (game.general.remakeCount !== 0) {
          game.general.status = `بازی تا ${formatNumber(game.general.remakeCount as number)} ثانیه‌ی دیگر دوباره ساخته می‌شود.`;
          (game.general.remakeCount as number)--;
        } else {
          clearInterval(game.private.remakeTimer);
          game.general.status = 'بازی دوباره ساخته شد.';
          game.general.isRemade = true;

          const remaining: GameChatLine = {
            isRemainingPolicies: true,
            timestamp: new Date(),
            chat: [
              { text: 'قوانین باقی‌مانده: ' },
              { policies: game.private.policies.map((policy) => (policy === 'liberal' ? 'b' : 'r')) },
              { text: '.' },
            ],
          };
          game.private.unSeatedGameChats.push(remaining);
          for (const seated of game.private.seatedPlayers) seated.gameChats.push(remaining);

          makeNewGame(game);
        }
        sendInProgressGameUpdate(game);
      }, 1000);
    }
  } else if (!data.remakeStatus && Date.now() > player.remakeTime + 2000) {
    player.isRemaking = false;
    player.remakeTime = Date.now();

    const votes = remakeData.filter((vote) => vote.isRemaking).length;
    if (game.general.isRemaking && votes < minimum) {
      game.general.isRemaking = false;
      game.general.status = 'ساخت دوباره‌ی بازی لغو شد.';
      clearInterval(game.private.remakeTimer);
    }
    chat.chat.push({ text: ` رأی خود را برای ساخت دوباره‌ی بازی پس گرفت. (${formatNumber(votes)}/${formatNumber(minimum)})` });
  } else {
    return;
  }

  socket.emit('updateRemakeVoting', player.isRemaking);
  game.chats.push(chat);
  sendInProgressGameUpdate(game);
}
