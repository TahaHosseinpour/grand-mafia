import type { UserGameSettings } from '@/features/users';
import type { PublicPlayer } from './types';

/** A fresh seat at the table for a player (legacy `updateSeatedUser` / create-game). */
export function newSeat(userName: string, settings: UserGameSettings, extra: Partial<PublicPlayer> = {}): PublicPlayer {
  return {
    userName,
    connected: true,
    isDead: false,
    customCardback: settings.customCardback,
    customCardbackUid: settings.customCardbackUid,
    isPrivate: settings.isPrivate,
    tournyWins: settings.tournyWins,
    previousSeasonAward: settings.previousSeasonAward,
    specialTournamentStatus: settings.specialTournamentStatus,
    staffDisableVisibleElo: settings.staffDisableVisibleElo,
    staffDisableVisibleXP: settings.staffDisableVisibleXP,
    staffDisableStaffColor: settings.staffDisableStaffColor,
    cardStatus: { cardDisplayed: false, isFlipped: false, cardFront: 'secretrole', cardBack: {} },
    ...extra,
  };
}
