import type { UserListItem } from '../wire';

/**
 * The colour of a player's name (legacy `PLAYERCOLORS` and the `.elo*`,
 * `.experienced*`, `.onfire*` and staff classes of style-dark.scss), as a
 * CSS colour instead of a class. Staff and contributors have fixed colours;
 * a «rainbow» player (10+ XP) is coloured by Elo, or by experience and win
 * rate when they hide Elo; everyone else is plain.
 */

const STAFF_COLORS: Record<string, string> = {
  admin: '#ff4d4d',
  moderator: '#3d9bff',
  editor: '#05bba0',
  veteran: '#84b8fd',
};
const CONTRIBUTOR_COLOR = '#21bae0';

/** Elo anchor points: [elo, hue, saturation, lightness] (0–1). */
const ELO_STOPS: [number, number, number, number][] = [
  [1500, 0.3, 1, 0.3],
  [1600, 0.3, 1, 0.5],
  [1849, 0, 1, 0.7],
  [1850, 1, 1, 0.7],
  [1900, 0.9, 1, 0.6],
  [2000, 0.8, 1, 0.4],
  [2100, 0.7, 1, 0.5],
];

/** The colour the legacy SCSS computed for an Elo (stepped by 5, 1500–2100). */
export function eloColor(elo: number): string {
  const clamped = Math.min(2100, Math.max(1500, 1500 + Math.round((elo - 1500) / 5) * 5));
  let low = ELO_STOPS[0];
  let high = ELO_STOPS[ELO_STOPS.length - 1];
  for (const stop of ELO_STOPS) {
    if (stop[0] > low[0] && stop[0] <= clamped) low = stop;
    if (stop[0] < high[0] && stop[0] >= clamped) high = stop;
  }
  const scale = high[0] - low[0];
  const t = scale <= 0 ? 0 : Math.min(1, Math.max(0, (clamped - low[0]) / scale));
  const mix = (i: 1 | 2 | 3) => low[i] * (1 - t) + high[i] * t;
  return `hsl(${Math.round(mix(1) * 360)}, ${Math.round(mix(2) * 100)}%, ${Math.round(mix(3) * 100)}%)`;
}

type Colourable = Pick<
  UserListItem,
  'userName' | 'staffRole' | 'staffDisableStaffColor' | 'isContributor' | 'wins' | 'losses' | 'winsSeason' | 'lossesSeason' | 'isRainbowOverall' | 'isRainbowSeason' | 'eloOverall' | 'eloSeason'
>;

/**
 * @param seasonal show this season's numbers (the default) rather than all-time
 * @param eloHidden the viewer hides Elo: rainbow players are coloured by games played and win rate
 * @returns a CSS colour, or undefined for the default text colour
 */
export function playerColor(user: Colourable | undefined, seasonal = true, eloHidden = false): string | undefined {
  if (!user) return undefined;
  const role = user.staffRole || '';
  const showsStaffColour = role && role !== 'trialmod' && role !== 'altmod' && !user.staffDisableStaffColor;
  if (showsStaffColour && STAFF_COLORS[role]) return STAFF_COLORS[role];
  if (user.isContributor) return CONTRIBUTOR_COLOR;

  const rainbow = seasonal ? user.isRainbowSeason : user.isRainbowOverall;
  if (!rainbow) return undefined;

  if (!eloHidden) return eloColor((seasonal ? user.eloSeason : user.eloOverall) ?? 1600);

  const wins = (seasonal ? user.winsSeason : user.wins) ?? 0;
  const losses = (seasonal ? user.lossesSeason : user.losses) ?? 0;
  const games = wins + losses;
  const rate = games ? wins / games : 0;
  // Win rate beats experience: one step per 2% above 50%, up to 70%.
  const fire = [0.52, 0.54, 0.56, 0.58, 0.6, 0.62, 0.64, 0.66, 0.68, 0.7].filter((threshold) => rate > threshold).length;
  if (fire) return `rgb(183, ${(10 - fire) * 15}, 167)`;
  const experience = [49, 99, 199, 299, 499].filter((threshold) => games > threshold).length;
  return experience ? `rgb(19, ${222 - experience * 20}, 19)` : undefined;
}
