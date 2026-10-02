/**
 * Constants the game server and the game client share (legacy
 * `src/frontend-scripts/node-constants.js`). Isomorphic: no server imports.
 */

/** The ranked season in progress. Season statistics are keyed by this. */
export const CURRENT_SEASON_NUMBER = 23;

/** XP at which a player becomes «رنگین‌کمانی» (rainbow): coloured name, rainbow games. */
export const RAINBOW_XP = 10;

/** Elo every account starts at. */
export const DEFAULT_ELO = 1600;

const ALPHANUMERIC = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890';
const SYMBOLS = ' -_=+!"£$%^&*()\\/.,<>?#~\'@;:[]{}';
const LATIN_EXT_A =
  'ĀāĂăĄąĆćĈĉĊċČčĎďĐđĒēĔĕĖėĘęĚěĜĝĞğĠġĢģĤĥĦħĨĩĪīĬĭĮįİıĲĳĴĵĶķĸĹĺĻļĽľĿŀŁłŃńŅņŇňŉŊŋŌōŎŏŐőŒœŔŕŖŗŘřŚśŜŝŞşŠšŢţŤťŦŧŨũŪūŬŭŮůŰűŲųŴŵŶŷŸŹźŻżŽžſ';
// Persian: the Arabic block (letters, Persian digits, punctuation), the
// zero-width non-joiner Persian needs inside words, and the Arabic-Indic digits.
const PERSIAN = /^[؀-ۿ‌]$/u;

const LATIN_SET = new Set([...ALPHANUMERIC, ...SYMBOLS, ...LATIN_EXT_A]);

/** Game names may mix Latin, Persian and the legacy symbols. */
export function isLegalGameName(text: string): boolean {
  return [...text].every((char) => LATIN_SET.has(char) || PERSIAN.test(char));
}
