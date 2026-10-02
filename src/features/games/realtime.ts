/**
 * The game engine's entry points for the Socket.IO layer (`src/realtime`).
 * Not part of the server barrel: pages never need the engine, only the
 * process that hosts the sockets does.
 */
export { setHub, findGame, engineStore } from './engine/store';
export type { Hub, HubSocket } from './engine/hub';
export type { Game, Caller } from './engine/types';

export { startListBroadcasts, sendGameList, sendUserList } from './engine/lists';
export { startGarbageCollector } from './engine/garbage';
export { startFlagSync } from './engine/flags';
export { admitConnection } from './engine/connection';
export { handleSocketDisconnect, handleUserLeaveGame } from './engine/lobby';
export { sendUserGameSettings } from './engine/presence';
export { sendGeneralChats, sendGameInfo, sendPlayerNotes, updateStatusFor } from './engine/requests';
export { getEmoteList } from './engine/emotes';

export { checkRestriction, confirmTerms, acknowledgeWarning, handleFeedbackForm } from './engine/restrictions';
export { handleUpdatedGameSettings, handleUpdatedBio, handleUpdatedTheme, handleHasSeenNewPlayerModal } from './engine/settings';

export { handleAddNewGame, handleUpdateWhitelist } from './engine/create-game';
export { handleSeatRequest } from './engine/join-game';
export { handleUpdatedRemakeGame } from './engine/remake-game';
export { handleAddNewClaim } from './engine/claim';
export { handleNewGeneralChat, handleAddNewGameChat } from './engine/player-chat';

export { selectChancellor } from './engine/election-util';
export {
  selectVoting,
  selectPresidentPolicy,
  selectChancellorPolicy,
  selectPresidentVoteOnVeto,
  selectChancellorVoteOnVeto,
} from './engine/election';
export {
  selectPolicies,
  selectOnePolicy,
  selectBurnCard,
  selectPartyMembershipInvestigate,
  selectPartyMembershipInvestigateReverse,
  selectSpecialElection,
  selectPlayerToExecute,
} from './engine/policy-powers';
export { selectPlayerToAssassinate } from './engine/assassination';

/** Wire shapes of the in-game events; the realtime layer parses with these before calling the engine. */
export { voteInput, chancellorInput, playerIndexInput, policySelectionInput, leaveGameInput } from './inputs';
