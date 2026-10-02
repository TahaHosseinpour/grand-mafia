import localFont from 'next/font/local';

/**
 * Vazirmatn, self-hosted (variable weight 100–900).
 *
 * Self-hosted rather than `next/font/google` so a build on a server without
 * access to Google Fonts still works. Licensed under the SIL OFL
 * (fonts/OFL-vazirmatn.txt).
 */
export const vazirmatn = localFont({
  src: './fonts/vazirmatn-variable.woff2',
  weight: '100 900',
  style: 'normal',
  display: 'swap',
  variable: '--font-vazirmatn',
});

/**
 * Lalezar, the display face for headings and big buttons in the game
 * (Arabic-script subset; Latin falls back to Vazirmatn). SIL OFL
 * (fonts/OFL-lalezar.txt).
 */
export const lalezar = localFont({
  src: './fonts/lalezar-arabic.woff2',
  weight: '400',
  style: 'normal',
  display: 'swap',
  variable: '--font-lalezar',
});
