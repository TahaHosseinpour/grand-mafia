import { z } from '@/lib/validation';

/**
 * Wire shapes for the settings events (`updateGameSettings`, `updateBio`,
 * `handleUpdatedTheme`). The settings document is an open key/value map: the
 * handler applies only the keys it whitelists, so the schema only guarantees
 * an object.
 */

export const THEME_COLOR_FIELDS = ['primaryColor', 'secondaryColor', 'tertiaryColor', 'backgroundColor', 'textColor'] as const;

const color = z.string().max(32).optional();

/** Any subset of the five colour fields; the client sends only what changed. */
export const themeInput = z
  .object({ primaryColor: color, secondaryColor: color, tertiaryColor: color, backgroundColor: color, textColor: color })
  .loose();

export type ThemeInput = z.output<typeof themeInput>;

export const gameSettingsInput = z.object({}).loose();

export const blacklistInput = z.array(z.object({ userName: z.string(), reason: z.string(), timestamp: z.number() }).loose()).max(30);

/** The «about me» text shown on a player's profile (`users.bio` is 500 characters). */
export const bioInput = z.string().max(500);
