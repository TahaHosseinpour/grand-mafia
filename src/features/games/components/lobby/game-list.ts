import type { GameFilters } from '@/features/users';
import type { GameListItem, UserListItem } from '../wire';

/**
 * Which games the lobby shows and in what order (legacy GamesList.jsx). The
 * filters are the player's saved `gameFilters`: each one *hides* a kind of
 * game when it is on.
 */

export type GameFilterKey = keyof GameFilters;

export const FILTERS: { key: GameFilterKey; label: string }[] = [
  { key: 'pub', label: 'عمومی' },
  { key: 'priv', label: 'خصوصی' },
  { key: 'unstarted', label: 'شروع‌نشده' },
  { key: 'inprogress', label: 'در جریان' },
  { key: 'completed', label: 'تمام‌شده' },
  { key: 'casualgame', label: 'غیررسمی' },
  { key: 'customgame', label: 'سفارشی' },
  { key: 'timedMode', label: 'زمان‌دار' },
  { key: 'standard', label: 'معمولی' },
  { key: 'rainbow', label: 'رنگین‌کمانی' },
];

export function isHidden(game: GameListItem, filters: GameFilters = {}): boolean {
  const completed = game.gameStatus === 'fascist' || game.gameStatus === 'liberal';
  return Boolean(
    (game.private && filters.priv) ||
      (!game.private && filters.pub) ||
      (game.rainbowgame && filters.rainbow) ||
      (!game.rainbowgame && filters.standard) ||
      (game.timedMode && filters.timedMode) ||
      (game.gameStatus === 'notStarted' && filters.unstarted) ||
      (game.gameStatus === 'isStarted' && filters.inprogress) ||
      (completed && filters.completed) ||
      (game.isCustomGame && filters.customgame) ||
      (game.casualGame && filters.casualgame)
  );
}

const STATUS_ORDER = ['notStarted', 'isStarted', 'fascist', 'liberal'];
const statusRank = (game: GameListItem) => Math.min(2, STATUS_ORDER.indexOf(String(game.gameStatus)));
const kind = (game: GameListItem) => (game.private ? 'private' : game.rainbowgame ? 'rainbow' : 'regular');

/**
 * The player's own game first; then waiting, running, finished; then the
 * kinds this player is likeliest to want (experienced players see rainbow
 * games first, private-profile players private ones); then fuller tables
 * first, then by name.
 */
export function sortGames(games: GameListItem[], me?: UserListItem): GameListItem[] {
  const order = !me || (!me.isPrivate && me.isRainbowOverall) ? ['rainbow', 'regular', 'private'] : me.isPrivate ? ['private', 'rainbow', 'regular'] : ['regular', 'rainbow', 'private'];
  const mine = (game: GameListItem) => (me && game.userNames.includes(me.userName) ? 0 : 1);

  return [...games].sort(
    (a, b) =>
      mine(a) - mine(b) ||
      statusRank(a) - statusRank(b) ||
      order.indexOf(kind(a)) - order.indexOf(kind(b)) ||
      b.seatedCount - a.seatedCount ||
      a.name.toLowerCase().localeCompare(b.name.toLowerCase()) ||
      (a.uid < b.uid ? 1 : -1)
  );
}

/** Tables a player could still take a seat at. */
export const isOpen = (game: GameListItem) => game.gameStatus === 'notStarted' && game.seatedCount < game.maxPlayersCount;
