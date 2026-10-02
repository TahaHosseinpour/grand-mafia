import { isSwitchOn } from '@/features/moderation';
import { rootLogger } from '@/server/logger';
import { engineStore } from './store';

/**
 * The engine reads moderator switches (new games off, new players limited…)
 * on every lobby action; it keeps a copy in memory and refreshes it here
 * (legacy `cloneSettingsFromRedis`).
 */

const SYNC_INTERVAL_MS = 30 * 1000;

export async function syncFlags(): Promise<void> {
  const { flags } = engineStore();
  try {
    flags.gameCreationDisabled = await isSwitchOn('gameCreationDisabled');
    flags.accountCreationDisabled = await isSwitchOn('accountCreationDisabled');
    flags.limitNewPlayers = await isSwitchOn('limitNewPlayers');
    flags.ipbansNotEnforced = await isSwitchOn('ipbansNotEnforced');
  } catch (error) {
    rootLogger.error({ err: error }, 'refreshing the global switches failed');
  }
}

let started = false;

/** Reads the switches now and then every 30 seconds. Idempotent; never keeps the process alive. */
export function startFlagSync(): void {
  if (started) return;
  started = true;
  void syncFlags();
  setInterval(() => void syncFlags(), SYNC_INTERVAL_MS).unref();
}
