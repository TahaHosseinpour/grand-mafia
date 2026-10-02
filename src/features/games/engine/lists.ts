import { engineStore, type OnlineUser } from './store';
import type { HubSocket } from './hub';
import type { Game } from './types';

/**
 * The lobby lists: who is online and which games exist. Both are marked dirty
 * when something changes and broadcast by a short loop, so a burst of changes
 * (a game filling up seat by seat) is one message (legacy `models.js`
 * emitters).
 */

const prune = <T>(value: T): T | undefined => (value ? value : undefined);

export function formattedUserList(isAem: boolean) {
  return engineStore()
    .userList.map((user) => ({
      userName: user.userName,
      playerPronouns: user.playerPronouns,
      wins: prune(user.wins),
      losses: prune(user.losses),
      rainbowWins: prune(user.rainbowWins),
      rainbowLosses: prune(user.rainbowLosses),
      isPrivate: prune(user.isPrivate),
      staffDisableVisibleElo: prune(user.staffDisableVisibleElo),
      staffDisableVisibleXP: prune(user.staffDisableVisibleXP),
      staffDisableStaffColor: prune(user.staffDisableStaffColor),
      customCardback: user.customCardback,
      customCardbackUid: user.customCardbackUid,
      eloOverall: user.eloOverall ? Math.floor(user.eloOverall) : undefined,
      xpOverall: user.xpOverall ? Math.floor(user.xpOverall) : undefined,
      eloSeason: user.eloSeason ? Math.floor(user.eloSeason) : undefined,
      xpSeason: user.xpSeason ? Math.floor(user.xpSeason) : undefined,
      isRainbowOverall: user.isRainbowOverall,
      isRainbowSeason: user.isRainbowSeason,
      status: user.status?.type && user.status.type !== 'none' ? user.status : undefined,
      winsSeason: prune(user.winsSeason),
      lossesSeason: prune(user.lossesSeason),
      rainbowWinsSeason: prune(user.rainbowWinsSeason),
      rainbowLossesSeason: prune(user.rainbowLossesSeason),
      previousSeasonAward: user.previousSeasonAward,
      specialTournamentStatus: user.specialTournamentStatus,
      timeLastGameCreated: user.timeLastGameCreated,
      staffRole: prune(user.staffRole),
      staffIncognito: prune(user.staffIncognito),
      isContributor: prune(user.isContributor),
    }))
    .filter((user) => isAem || !user.staffIncognito);
}

const isUserListStaff = (socket: HubSocket) =>
  socket.staffRole === 'moderator' || socket.staffRole === 'admin' || socket.staffRole === 'trialmod';

export function formattedGameList() {
  return [...engineStore().games.values()].map((game) => {
    const { general, publicPlayersState, gameState, trackState } = game;
    return {
      name: general.name,
      flag: general.flag,
      userNames: publicPlayersState.map((player) => player.userName),
      customCardback: publicPlayersState.map((player) => player.customCardback),
      customCardbackUid: publicPlayersState.map((player) => player.customCardbackUid),
      gameStatus: gameState.isCompleted ? gameState.isCompleted : gameState.isTracksFlipped ? 'isStarted' : 'notStarted',
      seatedCount: publicPlayersState.length,
      gameCreatorName: game.private.gameCreatorName,
      minPlayersCount: general.minPlayersCount,
      maxPlayersCount: general.maxPlayersCount || general.minPlayersCount,
      excludedPlayerCount: general.excludedPlayerCount,
      casualGame: general.casualGame || undefined,
      practiceGame: general.practiceGame || undefined,
      eloMinimum: general.eloMinimum || undefined,
      xpMinimum: general.xpMinimum || undefined,
      isVerifiedOnly: general.isVerifiedOnly || undefined,
      timedMode: general.timedMode || undefined,
      flappyMode: general.flappyMode || undefined,
      flappyOnlyMode: general.flappyOnlyMode || undefined,
      experiencedMode: general.experiencedMode || undefined,
      playerChats: general.playerChats || undefined,
      disableGamechat: general.disableGamechat || undefined,
      blindMode: general.blindMode || undefined,
      enactedLiberalPolicyCount: trackState.liberalPolicyCount,
      enactedFascistPolicyCount: trackState.fascistPolicyCount,
      electionCount: general.electionCount,
      rebalance6p: general.rebalance6p || undefined,
      rebalance7p: general.rebalance7p || undefined,
      rebalance9p2f: general.rebalance9p2f || undefined,
      privateOnly: general.privateOnly || undefined,
      private: general.private || undefined,
      uid: general.uid,
      rainbowgame: general.rainbowgame || undefined,
      isCustomGame: game.customGameSettings.enabled,
      isUnlisted: general.unlistedGame || undefined,
      avalonSH: general.avalonSH || undefined,
      monarchistSH: general.monarchistSH || undefined,
      noTopdecking: general.noTopdecking || undefined,
    };
  });
}

/** Sends the user list to one socket, or marks it for broadcast. */
export function sendUserList(socket?: HubSocket): void {
  if (socket) {
    socket.emit('userList', { list: formattedUserList(isUserListStaff(socket)) });
  } else {
    engineStore().dirty.userList = true;
  }
}

/** Sends the game list to one socket, or marks it for broadcast. */
export function sendGameList(socket?: HubSocket, isAem = false): void {
  if (socket) {
    socket.emit(
      'gameList',
      formattedGameList().filter((game) => isAem || !game.isUnlisted)
    );
  } else {
    engineStore().dirty.gameList = true;
  }
}

/** What the sidebar shows next to a player's name: playing, observing… */
export function updateUserStatus(username: string, game?: Game | null, override?: string): void {
  const user = engineStore().userList.find((entry) => entry.userName === username);
  if (!user) return;
  user.status = {
    type:
      override && game && !game.general.unlistedGame
        ? override
        : game
          ? game.general.private
            ? 'private'
            : !game.general.unlistedGame && game.general.rainbowgame
              ? 'rainbow'
              : !game.general.unlistedGame
                ? 'playing'
                : 'none'
          : 'none',
    gameId: game ? game.general.uid : false,
  };
  sendUserList();
}

export function findOnlineUser(username: string): OnlineUser | undefined {
  return engineStore().userList.find((entry) => entry.userName === username);
}

/**
 * Starts the loop that broadcasts the lists. Idempotent. The loop is unref'd,
 * so it never keeps the process (or a test run) alive.
 */
export function startListBroadcasts(): void {
  const store = engineStore();
  if (store.timers.started) return;
  store.timers.started = true;

  let userCooldown = 0;
  let gameCooldown = 0;

  setInterval(() => {
    // User list: wait 10 ms per online user after a change, so a burst of
    // sign-ins is one broadcast.
    if (!store.dirty.userList) {
      userCooldown = store.userList.length / 10;
    } else if (userCooldown > 0) {
      userCooldown--;
    } else {
      store.dirty.userList = false;
      for (const socket of store.hub.allSockets()) {
        socket.emit('userList', { list: formattedUserList(isUserListStaff(socket)) });
      }
    }

    // Game list: the first change goes out at once, then at most one every 3 s.
    if (gameCooldown > 0) {
      gameCooldown--;
    } else if (store.dirty.gameList) {
      store.dirty.gameList = false;
      store.hub.emitAll('gameList', formattedGameList());
      gameCooldown = 30;
    }
  }, 100).unref();
}
