import { emit } from '../socket';
import { setState } from '../store';
import type { UserGameSettings } from '../wire';

/** Saves settings: shown at once, confirmed by the server's `gameSettings` reply. */
export function saveSettings(patch: Partial<UserGameSettings>): void {
  setState((state) => ({ userInfo: { ...state.userInfo, gameSettings: { ...state.userInfo.gameSettings, ...patch } } }));
  emit('updateGameSettings', patch);
}
