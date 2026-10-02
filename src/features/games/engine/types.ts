/**
 * The engine's in-memory game model — the same object the legacy server kept
 * (`legacy/routes/socket`), typed. The Socket.IO client protocol is built on
 * these exact shapes, so field names are not up for renaming.
 *
 * `game.private`, `remakeData`, `guesses`, `unsentReports` and `summary`
 * never leave the server: `secureGame()` strips them from every update.
 */
import type { LineGuess } from './line-guess';
import type { GameSummary } from './summary';

export type Team = 'liberal' | 'fascist';
export type PolicyName = Team;
export type RoleName = 'liberal' | 'fascist' | 'hitler' | 'merlin' | 'percival' | 'morgana' | 'monarchist';

export type Role = {
  cardName: RoleName;
  team: Team;
  /** The liberal/fascist artwork variant (0–5 / 18–20); absent for named roles. */
  icon?: number;
};

/** What a presidential power is called in `customGameSettings.powers`. */
export type PowerName = 'investigate' | 'deckpeek' | 'election' | 'bullet' | 'reverseinv' | 'peekdrop';

/** Phases the client switches its UI on. */
export type Phase =
  | 'selectingChancellor'
  | 'voting'
  | 'presidentSelectingPolicy'
  | 'chancellorSelectingPolicy'
  | 'chancellorVoteOnVeto'
  | 'presidentVoteOnVeto'
  | 'enactPolicy'
  | 'selectPartyMembershipInvestigate'
  | 'selectPartyMembershipInvestigateReverse'
  | 'specialElection'
  | 'execution'
  | 'presidentVoteOnBurn'
  | 'assassination';

/* ------------------------------------------------------------------ *
 * Chat
 * ------------------------------------------------------------------ */

export type ChatPartType = 'player' | RoleName | 'liberal' | 'fascist';

export type ChatPart =
  | { text: string; type?: ChatPartType }
  | { policies: string[] }
  | { claim: string };

/** A line written by the game itself (events, role reveals, results). */
export type GameChatLine = {
  gameChat?: true;
  isRemainingPolicies?: true;
  isClaim?: true;
  timestamp: Date | number;
  chat: ChatPart[];
  /** Only claim lines. */
  uid?: string;
  userName?: string;
  claim?: string;
  claimState?: string;
};

/** A line typed by a person. */
export type PlayerChatLine = {
  chat: string;
  userName: string;
  hiddenUsername?: string;
  staffRole?: string;
  timestamp: Date | number;
  uid?: string;
  gameChat?: undefined;
};

export type ChatEntry = GameChatLine | PlayerChatLine;

/* ------------------------------------------------------------------ *
 * Card display state
 * ------------------------------------------------------------------ */

export type CardBack = Role | { cardName?: string } | string;

export type CardStatus = {
  cardDisplayed?: boolean;
  isFlipped?: boolean;
  cardFront?: string;
  cardBack?: CardBack;
};

export type CardFlinger = {
  position: string;
  action?: string;
  notificationStatus?: string;
  cardStatus: { isFlipped: boolean; cardFront: string; cardBack: string };
  discard?: boolean;
};

/** One player's private view of another seat (and of themself). */
export type SeatView = {
  notificationStatus?: string;
  nameStatus?: string;
  cardStatus: CardStatus;
  claim?: string;
  policyNotification?: boolean;
};

/* ------------------------------------------------------------------ *
 * Players
 * ------------------------------------------------------------------ */

export type PublicPlayer = {
  userName: string;
  connected: boolean;
  isDead?: boolean;
  leftGame?: boolean;
  customCardback?: string;
  customCardbackUid?: string;
  isPrivate?: boolean;
  tournyWins?: number[];
  previousSeasonAward?: string;
  specialTournamentStatus?: string;
  staffDisableVisibleElo?: boolean;
  staffDisableVisibleXP?: boolean;
  staffDisableStaffColor?: boolean;
  cardStatus: CardStatus;
  governmentStatus?: '' | 'isPendingPresident' | 'isPendingChancellor' | 'isPresident' | 'isChancellor';
  previousGovernmentStatus?: '' | 'wasPresident' | 'wasChancellor';
  isLoader?: boolean;
  isConfetti?: boolean;
  notificationStatus?: string;
  nameStatus?: string;
  isRemakeVoting?: boolean;
  pingTime?: number;
};

export type SeatedPlayer = PublicPlayer & {
  role: Role;
  playersState: SeatView[];
  gameChats: ChatEntry[];
  cardFlingerState?: CardFlinger[];
  voteStatus?: { hasVoted: boolean; didVoteYes?: boolean };
  wasInvestigated?: boolean;
  wonGame?: boolean;
};

/* ------------------------------------------------------------------ *
 * Game
 * ------------------------------------------------------------------ */

export type CustomGameSettings = {
  enabled: boolean;
  deckState?: { lib: number; fas: number };
  trackState?: { lib: number; fas: number };
  fascistCount?: number;
  hitlerZone?: number;
  vetoZone?: number;
  powers?: (PowerName | null)[];
  hitKnowsFas?: boolean;
  fasCanShootHit?: boolean;
};

/** After `beginGame` every standard setting is filled in as well. */
export type ActiveGameSettings = Required<
  Pick<CustomGameSettings, 'deckState' | 'trackState' | 'fascistCount' | 'hitlerZone' | 'vetoZone' | 'powers'>
> &
  CustomGameSettings;

export type General = {
  whitelistedPlayers: string[];
  uid: string;
  name: string;
  flag: string;
  minPlayersCount: number;
  maxPlayersCount: number;
  excludedPlayerCount: number[];
  status: string;
  experiencedMode?: boolean;
  playerChats?: string;
  isVerifiedOnly?: boolean;
  disableObserverLobby?: boolean;
  disableObserver?: boolean;
  lastModPing: number;
  chatReplTime: number[];
  disableGamechat?: boolean;
  rainbowgame?: boolean;
  blindMode?: boolean;
  timedMode: number | false;
  flappyMode?: boolean;
  flappyOnlyMode?: boolean;
  casualGame?: boolean;
  practiceGame?: boolean;
  rebalance6p?: boolean;
  rebalance7p?: boolean;
  rebalance9p2f?: boolean;
  rerebalance9p?: boolean;
  unlistedGame?: boolean;
  /** `true` once a game is private; the password itself is in `game.private`. */
  private: boolean | string;
  privateAnonymousRemakes?: boolean;
  privateOnly?: boolean;
  electionCount: number;
  isRemade: boolean;
  isRemaking?: boolean;
  remakeCount?: number;
  isRecorded?: boolean;
  eloMinimum?: number;
  xpMinimum?: number;
  avalonSH: { withPercival: boolean } | null;
  monarchistSH: boolean;
  noTopdecking?: number;
  timeCreated?: Date;
  timeStarted?: number;
  timeAbandoned?: Date | null;
  modDeleteDelay?: Date;
  /** 0 = 5–6 players, 1 = 7–8, 2 = 9–10: which fascist track is used. */
  type: number;
  playerCount: number;
  livingPlayerCount: number;
  replacementNames?: string[];
};

export type GameState = {
  previousElectedGovernment: number[];
  undrawnPolicyCount: number;
  discardedPolicyCount: number;
  presidentIndex: number;
  isStarted?: boolean;
  isTracksFlipped?: boolean;
  isCompleted?: false | Team;
  timeCompleted?: number;
  cancellStart?: boolean;
  phase?: Phase;
  audioCue?: string;
  pendingChancellorIndex?: number | null;
  specialElectionFormerPresidentIndex?: number | null;
  clickActionInfo?: [string, number[]];
  isVetoEnabled?: boolean;
  timedModeEnabled?: boolean;
  isGameFrozen?: boolean;
};

export type EnactedPolicy = { position: string; cardBack: PolicyName; isFlipped: boolean };

export type TrackState = {
  liberalPolicyCount: number;
  fascistPolicyCount: number;
  electionTrackerCount: number;
  enactedPolicies: EnactedPolicy[];
  consecutiveTopdecks?: number;
};

export type RemakeVote = { userName: string; isRemaking: boolean; timesVoted: number; remakeTime: number };

export type GamePrivate = {
  reports: Record<string, unknown>;
  unSeatedGameChats: ChatEntry[];
  commandChats: Record<string, GameChatLine[]>;
  /** Lines that only exist in the finished-game record (timer actions, Elo). */
  replayGameChats: ChatEntry[];
  lock: Record<string, boolean | undefined>;
  votesPeeked: boolean;
  remakeVotesPeeked: boolean;
  invIndex: number;
  hiddenInfoChat: GameChatLine[];
  hiddenInfoSubscriptions: string[];
  hiddenInfoShouldNotify: boolean;
  gameCreatorName: string;
  gameCreatorBlacklist: unknown[] | null | undefined;
  privatePassword?: string;
  seatedPlayers: SeatedPlayer[];
  policies: PolicyName[];
  summary: GameSummary;
  voteSpamData: { unvoteTimer: NodeJS.Timeout | number }[];
  timerId: NodeJS.Timeout | null;
  remakeTimer?: NodeJS.Timeout;
  currentElectionPolicies: PolicyName[];
  currentChancellorOptions: PolicyName[];
  _chancellorPlayerName?: string;
};

export type UnsentReport = Record<string, unknown> & { type: string };

export type Game = {
  general: General;
  gameState: GameState;
  trackState: TrackState;
  customGameSettings: CustomGameSettings;
  publicPlayersState: PublicPlayer[];
  chats: ChatEntry[];
  private: GamePrivate;
  remakeData?: RemakeVote[];
  /** Line guesses by observers: `username -> "123h"`. */
  guesses: Record<string, LineGuess>;
  merlinGuesses: Record<string, number>;
  unsentReports?: UnsentReport[];
  summarySaved?: boolean;
  /** Kept for the client contract; the per-player copies live on seated players. */
  playersState?: SeatView[];
  cardFlingerState?: CardFlinger[];
};

/** What a socket handler knows about who is acting (see `Actor` in `@/server/socket-auth`). */
export type Caller = { username: string };
