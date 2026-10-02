import { finishedGameExistsForEngine } from '../dal';
import { createGameInput, customGameSettingsInput, whitelistInput } from '../inputs';
import { formatNumber } from '@/lib/datetime';
import { T } from '@/lib/glossary';
import { chatReplacements } from './chat-replacements';
import { line, typed } from './chat';
import { sendGameList, updateUserStatus, findOnlineUser } from './lists';
import { newSeat } from './seats';
import { engineStore, findGame } from './store';
import { secureGame, sendInProgressGameUpdate } from './updates';
import { generateGameUid } from './uid';
import type { HubSocket } from './hub';
import type { Caller, CustomGameSettings, Game, GameChatLine } from './types';

/** «در دسته‌ی قوانین X لیبرال و Y فاشیست خواهد بود.» + the starting-tracks line, for custom games. */
function customGameIntro(settings: CustomGameSettings): GameChatLine[] {
  const deck = settings.deckState as { lib: number; fas: number };
  const track = settings.trackState as { lib: number; fas: number };
  const first = line(
    'در دسته‌ی قوانین ',
    typed('liberal', `${formatNumber(deck.lib - track.lib)} لیبرال`),
    ' و ',
    typed('fascist', `${formatNumber(deck.fas - track.fas)} فاشیست`),
    ' خواهد بود.'
  );
  const second = line(
    'بازی با ',
    typed('liberal', `${formatNumber(track.lib)} ${T.liberalPolicy}`),
    ' و ',
    typed('fascist', `${formatNumber(track.fas)} ${T.fascistPolicy}`),
    ' آغاز می‌شود.'
  );
  (second.timestamp as Date).setMilliseconds((first.timestamp as Date).getMilliseconds() + 1);
  return [first, second];
}

/**
 * A player creates a game (legacy `handleAddNewGame`). The creator's online
 * entry supplies their Elo, XP and settings; the payload only chooses options.
 */
export async function handleAddNewGame(socket: HubSocket, caller: Caller, raw: unknown): Promise<void> {
  const parsed = createGameInput.safeParse(raw);
  if (!parsed.success) return;
  const data = parsed.data;

  const store = engineStore();
  if (store.flags.gameCreationDisabled || (!data.privatePassword && store.flags.limitNewPlayers)) return;

  const user = findOnlineUser(caller.username);
  const now = Date.now();
  // One game per eight seconds, and not while already in a game.
  if (!user || now - (user.timeLastGameCreated ?? 0) < 8000 || user.status.type !== 'none') return;

  const minPlayers = Math.max(5, Math.min(10, data.minPlayersCount ?? 5));
  const maxPlayers = Math.max(5, Math.min(10, data.maxPlayersCount ?? 10));
  if (minPlayers > maxPlayers) return;

  let playerCounts: number[] = [];
  for (let count = minPlayers; count <= maxPlayers; count++) {
    if (!data.excludedPlayerCount?.includes(count)) playerCounts.push(count);
  }
  if (!playerCounts.length) return;

  const excludes: number[] = [];
  for (let count = playerCounts[0]; count <= playerCounts[playerCounts.length - 1]; count++) {
    if (!playerCounts.includes(count)) excludes.push(count);
  }

  let eloLimit: number | undefined;
  if (data.eloSliderValue) {
    if (user.eloSeason < Number(data.eloSliderValue) || user.eloOverall < Number(data.eloSliderValue)) return;
    eloLimit = Number.parseInt(String(data.eloSliderValue), 10);
    if (Number.isNaN(eloLimit)) return;
  }

  let xpLimit: number | undefined;
  if (data.xpSliderValue) {
    if (user.xpOverall < Number(data.xpSliderValue)) return;
    xpLimit = Number.parseInt(String(data.xpSliderValue), 10);
    if (Number.isNaN(xpLimit)) return;
  }

  let customSettings: CustomGameSettings = { enabled: false };
  if (data.customGameSettings && (data.customGameSettings as { enabled?: boolean }).enabled) {
    const parsedSettings = customGameSettingsInput.safeParse(data.customGameSettings);
    if (!parsedSettings.success) return;
    customSettings = parsedSettings.data as CustomGameSettings;

    // There may never be a fascist majority at the start.
    if ((customSettings.fascistCount as number) + 1 > playerCounts[0] / 2) return;

    playerCounts = [playerCounts[0]]; // custom games are locked to one table size
  }

  let uid = generateGameUid();
  while (await finishedGameExistsForEngine(uid)) uid = generateGameUid();

  const timedMode = typeof data.timedMode === 'number' && data.timedMode >= 2 && data.timedMode <= 6000 ? data.timedMode : false;
  const customGame = Boolean(customSettings.enabled);
  const fastTimer = typeof data.timedMode === 'number' && data.timedMode < 30;
  // A custom game is its own category; the other casual-making options make a casual game.
  const casualGame =
    !customGame &&
    Boolean(
      data.casualGame ||
        fastTimer ||
        data.gameType === 'casual' ||
        data.avalonSH ||
        data.withPercival ||
        data.monarchistSH ||
        (data.noTopdecking ?? 0) > 0
    );
  const practiceGame = !fastTimer && data.gameType === 'practice' && !casualGame && !customGame;
  const emotes = data.playerChats === 'emotes';

  const game: Game = {
    gameState: { previousElectedGovernment: [], undrawnPolicyCount: 17, discardedPolicyCount: 0, presidentIndex: -1 },
    chats: [],
    general: {
      whitelistedPlayers: [],
      uid,
      name: user.isPrivate ? 'بازی خصوصی' : data.gameName || 'بازی جدید',
      flag: data.flag || 'none',
      minPlayersCount: playerCounts[0],
      excludedPlayerCount: excludes,
      maxPlayersCount: playerCounts[playerCounts.length - 1],
      status: `منتظر ${formatNumber(playerCounts[0] - 1)} بازیکن دیگر…`,
      experiencedMode: data.experiencedMode,
      playerChats: emotes && ['casual', 'practice'].includes(data.gameType ?? '') ? 'emotes' : emotes ? 'enabled' : data.playerChats,
      isVerifiedOnly: data.isVerifiedOnly,
      disableObserverLobby: data.disableObserverLobby,
      disableObserver: data.disableObserverLobby || data.disableObserver,
      lastModPing: 0,
      chatReplTime: Array(chatReplacements.length + 1).fill(0),
      disableGamechat: data.disableGamechat,
      rainbowgame: user.isRainbowOverall ? data.rainbowgame : false,
      blindMode: data.blindMode,
      timedMode,
      flappyMode: data.flappyMode,
      flappyOnlyMode: data.flappyMode && data.flappyOnlyMode,
      casualGame,
      practiceGame,
      rebalance6p: data.rebalance6p,
      rebalance7p: data.rebalance7p,
      rebalance9p2f: data.rebalance9p2f,
      unlistedGame: data.unlistedGame && !data.privatePassword,
      private: user.isPrivate ? data.privatePassword || 'private' : !data.unlistedGame && data.privatePassword ? data.privatePassword : false,
      privateAnonymousRemakes: data.privateAnonymousRemakes,
      privateOnly: user.isPrivate,
      electionCount: 0,
      isRemade: false,
      eloMinimum: eloLimit,
      xpMinimum: xpLimit,
      avalonSH: data.avalonSH ? { withPercival: Boolean(data.withPercival) } : null,
      monarchistSH: Boolean(data.monarchistSH),
      noTopdecking: data.noTopdecking,
      type: 0,
      playerCount: 0,
      livingPlayerCount: 0,
    },
    customGameSettings: customSettings,
    publicPlayersState: [
      newSeat(user.userName, {
        customCardback: user.customCardback,
        customCardbackUid: user.customCardbackUid,
        isPrivate: user.isPrivate,
        tournyWins: user.tournyWins,
        previousSeasonAward: user.previousSeasonAward,
        specialTournamentStatus: user.specialTournamentStatus,
      }),
    ],
    trackState: { liberalPolicyCount: 0, fascistPolicyCount: 0, electionTrackerCount: 0, enactedPolicies: [], consecutiveTopdecks: 0 },
    guesses: {},
    merlinGuesses: {},
    private: undefined as never,
  };

  if (customGame) game.chats.push(...customGameIntro(customSettings));

  user.timeLastGameCreated = now;

  const password = game.general.private ? String(game.general.private) : undefined;
  game.private = {
    reports: {},
    unSeatedGameChats: [],
    commandChats: {},
    replayGameChats: [],
    lock: {},
    votesPeeked: false,
    remakeVotesPeeked: false,
    invIndex: -1,
    hiddenInfoChat: [],
    hiddenInfoSubscriptions: [],
    hiddenInfoShouldNotify: true,
    gameCreatorName: user.userName,
    gameCreatorBlacklist: user.blacklist,
    seatedPlayers: [],
    policies: [],
    summary: undefined as never,
    voteSpamData: [],
    timerId: null,
    currentElectionPolicies: [],
    currentChancellorOptions: [],
    ...(password ? { privatePassword: password } : {}),
  };
  if (password) game.general.private = true;

  game.general.timeCreated = new Date(now);
  updateUserStatus(user.userName, game);
  store.games.set(uid, game);
  sendGameList();

  if (!game.general.unlistedGame) {
    store.hub.emitAll('newGameAdded', {
      priv: game.general.private,
      pub: !game.general.private,
      timedMode: game.general.timedMode,
      rainbow: game.general.rainbowgame,
      standard: !game.general.rainbowgame,
      customgame: game.customGameSettings.enabled,
      casualgame: game.general.casualGame,
      creator: user.userName,
    });
  }
  socket.join(uid);
  socket.emit('updateSeatForUser');
  socket.emit('gameUpdate', secureGame(game));
  socket.emit('joinGameRedirect', uid);
  sendInProgressGameUpdate(game);
}

/** The creator (or a player who knows the password) edits who may join a private game. */
export function handleUpdateWhitelist(caller: Caller, raw: unknown): void {
  const parsed = whitelistInput.safeParse(raw);
  if (!parsed.success) return;
  const data = parsed.data;
  const game = findGame(data.uid);
  if (!game) return;

  const isPrivateSafe =
    !game.general.private ||
    data.password === game.private.privatePassword ||
    game.general.whitelistedPlayers.includes(caller.username);

  if (isPrivateSafe || game.private.gameCreatorName === caller.username) {
    game.general.whitelistedPlayers = data.whitelistPlayers;
    engineStore().hub.emitRoom(data.uid, 'gameUpdate', secureGame(game));
  }
}
