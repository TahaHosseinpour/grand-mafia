// Server barrel for the ranking feature.
export { applyRankedResultForGameEnd, applyUnrankedXpForGameEnd } from './dal';
export type { RankedGameResult } from './dal';
export { computeEloChanges } from './elo';
export type { EloGameInfo, EloPlayer, EloChange } from './elo';
export type { PlayerRatingAfterGame } from './types';
