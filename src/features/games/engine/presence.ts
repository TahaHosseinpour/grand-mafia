import { loadPresenceForRealtime, type PresenceDTO } from '@/features/users';
import { APP_VERSION } from '@/lib/version';
import { sendUserList } from './lists';
import { engineStore, type OnlineUser } from './store';
import type { HubSocket } from './hub';

/** The lobby entry for a connected player (legacy `userListInfo`). */
export function toOnlineUser(account: PresenceDTO): OnlineUser {
  const settings = account.gameSettings;
  return {
    userName: account.username,
    playerPronouns: settings.playerPronouns,
    staffRole: account.staffRole ?? '',
    isContributor: account.isContributor,
    staffDisableVisibleElo: settings.staffDisableVisibleElo,
    staffDisableVisibleXP: settings.staffDisableVisibleXP,
    staffDisableStaffColor: settings.staffDisableStaffColor,
    staffIncognito: settings.staffIncognito,
    wins: account.wins,
    losses: account.losses,
    rainbowWins: account.rainbowWins,
    rainbowLosses: account.rainbowLosses,
    winsSeason: account.winsSeason,
    lossesSeason: account.lossesSeason,
    rainbowWinsSeason: account.rainbowWinsSeason,
    rainbowLossesSeason: account.rainbowLossesSeason,
    isRainbowOverall: account.isRainbowOverall,
    isRainbowSeason: account.isRainbowSeason,
    isPrivate: settings.isPrivate,
    tournyWins: settings.tournyWins ?? [],
    blacklist: settings.blacklist ?? [],
    customCardback: settings.customCardback,
    customCardbackUid: settings.customCardbackUid,
    previousSeasonAward: settings.previousSeasonAward,
    specialTournamentStatus: settings.specialTournamentStatus,
    eloOverall: account.eloOverall,
    xpOverall: account.xpOverall,
    eloSeason: account.eloSeason,
    xpSeason: account.xpSeason,
    status: { type: 'none', gameId: null },
  };
}

/**
 * Sends a player their settings and makes sure they are on the online list
 * (legacy `sendUserGameSettings`). Called by the client right after it connects.
 */
export async function sendUserGameSettings(socket: HubSocket): Promise<void> {
  if (!socket.username) return;
  const account = await loadPresenceForRealtime(socket.username);
  if (!account) return;

  socket.emit('gameSettings', account.gameSettings);

  const { userList } = engineStore();
  if (!userList.some((user) => user.userName === account.username)) {
    userList.push(toOnlineUser(account));
    sendUserList();
  }

  socket.emit('version', { current: APP_VERSION, lastSeen: account.lastVersionSeen || 'none' });
}
