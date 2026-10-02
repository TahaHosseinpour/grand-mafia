import { reportToModerators, type AutoReportInput } from '@/features/moderation';
import { findOnlineUser } from './lists';
import type { Game } from './types';

/**
 * Automatic reports and moderator pings raised from inside a game (legacy
 * `routes/socket/report.js`, which posted them to a Discord webhook).
 *
 * Rules kept from the original: nothing is reported from custom, unlisted or
 * private games; casual games get no auto-reports; and when a staff member is
 * seated, reports wait until the game ends (`unsentReports`) so the staff
 * member playing is not tipped off.
 */

export type ReportType = 'report' | 'reportdelayed' | 'modchat' | 'modchatdelayed' | 'ping';

export type ReportData = {
  player: string;
  seat?: number;
  role?: string;
  situation: string;
  election?: number;
  title?: string;
  uid?: string;
  gameType?: string;
  /** Pinged from the lobby, not from a game. */
  homepage?: boolean;
};

const gameTypeLabel = (game: Game) => (game.general.casualGame ? 'غیررسمی' : game.general.practiceGame ? 'تمرینی' : 'رتبه‌ای');

/** The header every report from a game shares. */
export const gameReportHeader = (game: Game) => ({
  election: game.general.electionCount,
  title: game.general.name,
  uid: game.general.uid,
  gameType: gameTypeLabel(game),
});

export function makeReport(data: ReportData, game: Game | null, type: ReportType = 'report'): void {
  if (!data.homepage) {
    if (!game || game.customGameSettings.enabled || game.general.unlistedGame || game.general.private) return;
    if (game.general.casualGame && (type === 'report' || type === 'reportdelayed')) return;
  }

  if (game && (type === 'report' || type === 'modchat')) {
    game.private.hiddenInfoShouldNotify = false;
  }

  const input: AutoReportInput = {
    kind: type.startsWith('modchat') ? 'modchat' : type === 'ping' ? 'ping' : 'report',
    delayed: type.endsWith('delayed'),
    player: data.player,
    seat: data.seat,
    role: data.role,
    situation: data.situation,
    election: data.election,
    gameUid: data.uid,
    gameTitle: data.title,
    gameType: data.gameType,
    seatedUserNames: game ? game.private.seatedPlayers.map((player) => player.userName) : [],
  };

  // A report about a game with staff seated waits for the end of the game.
  if (game && (type === 'report' || type === 'modchat') && staffSeated(game)) {
    (game.unsentReports ??= []).push({ ...data, type });
    return;
  }

  reportToModerators(input);
}

const STAFF_ROLES = ['altmod', 'moderator', 'editor', 'admin', 'trialmod'];

/** Does a staff member sit in this game? Roles are read from the online list. */
function staffSeated(game: Game): boolean {
  return game.private.seatedPlayers.some((player) => STAFF_ROLES.includes(findOnlineUser(player.userName)?.staffRole ?? ''));
}
