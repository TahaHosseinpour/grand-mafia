import { readdirSync } from 'node:fs';
import { join } from 'node:path';
import { APP_VERSION } from '@/lib/version';

/**
 * The emote list: every `public/images/emotes/<name>.png` is available as
 * `:name:` in chat (legacy `routes/socket/models.js`). Read once and cached.
 */

let cached: Record<string, string> | null = null;

export function getEmoteList(): Record<string, string> {
  if (cached) return cached;
  const emotes: Record<string, string> = {};
  try {
    for (const file of readdirSync(join(process.cwd(), 'public', 'images', 'emotes'), { withFileTypes: true })) {
      if (file.name.endsWith('.png')) {
        emotes[`:${file.name.slice(0, -4)}:`] = `/images/emotes/${file.name}?v=${APP_VERSION.number}`;
      }
    }
  } catch {
    // No emote folder (a bare checkout or a test): no emotes.
  }
  cached = emotes;
  return emotes;
}
