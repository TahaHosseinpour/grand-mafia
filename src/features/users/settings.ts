import type { Serializable } from '@/server/types';

/**
 * A player's saved preferences (`users.game_settings`), the shape the game
 * client reads and writes as one document. Isomorphic: the client imports the
 * types and the list of keys a player may change.
 */

export type BlacklistEntry = { userName: string; reason: string; timestamp: number };

export type GameFilters = {
  pub?: boolean;
  priv?: boolean;
  unstarted?: boolean;
  inprogress?: boolean;
  completed?: boolean;
  customgame?: boolean;
  casualgame?: boolean;
  timedMode?: boolean;
  standard?: boolean;
  rainbow?: boolean;
};

export type UserGameSettings = {
  playerPronouns?: string;
  staffDisableVisibleElo?: boolean;
  staffDisableVisibleXP?: boolean;
  staffDisableStaffColor?: boolean;
  staffIncognito?: boolean;
  isRainbow?: boolean;
  newReport?: boolean;
  hasUnseenBadge?: boolean;
  customCardback?: string;
  customCardbackSaveTime?: string;
  customCardbackUid?: string;
  enableTimestamps?: boolean;
  enableRightSidebarInGame?: boolean;
  disablePlayerColorsInChat?: boolean;
  disablePlayerCardbacks?: boolean;
  disableHelpMessages?: boolean;
  disableHelpIcons?: boolean;
  disableConfetti?: boolean;
  disableCrowns?: boolean;
  disableSeasonal?: boolean;
  disableAggregations?: boolean;
  disableKillConfirmation?: boolean;
  soundStatus?: string;
  unbanTime?: string;
  unTimeoutTime?: string;
  fontSize?: number;
  fontFamily?: string;
  isPrivate?: boolean;
  privateToggleTime?: number;
  blacklist?: BlacklistEntry[];
  tournyWins?: number[];
  hasChangedName?: boolean;
  previousSeasonAward?: string;
  specialTournamentStatus?: string;
  disableElo?: boolean;
  fullheight?: boolean;
  safeForWork?: boolean;
  keyboardShortcuts?: string;
  notifyForNewLobby?: boolean;
  gameFilters?: GameFilters;
  gameNotes?: { top: number; left: number; width: number; height: number };
  playerNotes?: Serializable[];
  ignoreIPBans?: boolean;
  truncatedSize?: number;
  claimCharacters?: string;
  claimButtons?: string;
};

/** Settings any player may change from the settings page. */
export const PLAYER_EDITABLE_SETTINGS = [
  'enableTimestamps',
  'enableRightSidebarInGame',
  'disablePlayerColorsInChat',
  'disablePlayerCardbacks',
  'disableHelpMessages',
  'disableHelpIcons',
  'disableConfetti',
  'disableCrowns',
  'disableSeasonal',
  'disableAggregations',
  'disableKillConfirmation',
  'soundStatus',
  'fontSize',
  'fontFamily',
  'isPrivate',
  'disableElo',
  'fullheight',
  'safeForWork',
  'keyboardShortcuts',
  'notifyForNewLobby',
  'gameFilters',
  'gameNotes',
  'playerNotes',
  'truncatedSize',
  'claimCharacters',
  'claimButtons',
] as const;

/** Extra settings staff may change. */
export const STAFF_EDITABLE_SETTINGS = [
  'staffDisableVisibleElo',
  'staffDisableVisibleXP',
  'staffDisableStaffColor',
  'staffIncognito',
] as const;

export const PRONOUN_OPTIONS = ['he/him/his', 'she/her/hers', 'they/them/theirs', 'Any Pronouns', ''] as const;
