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
