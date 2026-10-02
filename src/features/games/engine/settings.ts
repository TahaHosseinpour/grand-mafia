import {
  PLAYER_EDITABLE_SETTINGS,
  PRONOUN_OPTIONS,
  STAFF_EDITABLE_SETTINGS,
  bioInput,
  blacklistInput,
  dismissSignupModalForRealtime,
  gameSettingsInput,
  loadPresenceForRealtime,
  saveBioForRealtime,
  saveGameSettingsForRealtime,
  saveThemeForRealtime,
  themeInput,
  type UserGameSettings,
} from '@/features/users';
import { rootLogger } from '@/server/logger';
import { findOnlineUser, sendUserList } from './lists';
import { toOnlineUser } from './presence';
import { engineStore } from './store';
import type { Caller } from './types';
import type { HubSocket } from './hub';

/**
 * A player's own preferences: the settings page, the bio and the theme
 * colours (legacy `user-events/settings.js`).
 */

const log = rootLogger.child({ module: 'engine.settings' });

/** A player may switch between public and private only once every 18 hours. */
const PRIVATE_TOGGLE_COOLDOWN_MS = 18 * 60 * 60 * 1000;

const STAFF_ONLY_SETTINGS = new Set<string>(STAFF_EDITABLE_SETTINGS);
const PLAYER_SETTINGS = new Set<string>(PLAYER_EDITABLE_SETTINGS);

export async function handleUpdatedGameSettings(socket: HubSocket, caller: Caller, raw: unknown): Promise<void> {
  const parsed = gameSettingsInput.safeParse(raw);
  if (!parsed.success) return;
  const data = parsed.data as Record<string, unknown>;

  try {
    const account = await loadPresenceForRealtime(caller.username);
    if (!account) return;

    const settings: UserGameSettings = { ...account.gameSettings };
    const writable = settings as Record<string, unknown>;
    const currentPrivate = Boolean(settings.isPrivate);
    const role = account.staffRole;
    const isFullStaff = role === 'moderator' || role === 'editor' || role === 'admin';
    const mayChangeDisplay = isFullStaff || role === 'veteran';
    const online = findOnlineUser(caller.username);

    for (const [setting, value] of Object.entries(data)) {
      if (setting === 'blacklist') {
        const candidate = Array.isArray(value) ? value.slice(-30) : value;
        const list = blacklistInput.safeParse(candidate);
        if (list.success) {
          settings.blacklist = list.data;
          if (online) online.blacklist = list.data;
        }
      }

      const staffAllowed =
        (setting === 'staffIncognito' && isFullStaff) ||
        ((setting === 'staffDisableVisibleElo' || setting === 'staffDisableVisibleXP' || setting === 'staffDisableStaffColor') && mayChangeDisplay);
      if ((PLAYER_SETTINGS.has(setting) || (STAFF_ONLY_SETTINGS.has(setting) && staffAllowed)) && setting !== 'blacklist') {
        writable[setting] = value;
      }

      if (setting === 'playerPronouns' && typeof value === 'string' && (PRONOUN_OPTIONS as readonly string[]).includes(value)) {
        settings.playerPronouns = value;
        if (online) online.playerPronouns = value;
      }
    }

    // Public/private is a deliberate, rare change: it takes a reconnect to apply and is rate limited.
    const wantsPrivate = typeof data.isPrivate === 'boolean' ? data.isPrivate : currentPrivate;
    const toggled = wantsPrivate !== currentPrivate;
    const toggleAllowed = !settings.privateToggleTime || settings.privateToggleTime < Date.now() - PRIVATE_TOGGLE_COOLDOWN_MS;

    if (toggled && toggleAllowed) {
      settings.isPrivate = wantsPrivate;
      settings.privateToggleTime = Date.now();
      await saveGameSettingsForRealtime(caller.username, settings);
      socket.emit('manualDisconnection');
      return;
    }

    settings.isPrivate = currentPrivate;
    await saveGameSettingsForRealtime(caller.username, settings);

    if (isFullStaff && 'staffIncognito' in data) {
      // The online list shows incognito moderators to nobody: rebuild their entry.
      const { userList } = engineStore();
      const index = userList.findIndex((user) => user.userName === caller.username);
      const entry = toOnlineUser({ ...account, gameSettings: settings });
      if (index !== -1) {
        entry.status = userList[index].status;
        userList.splice(index, 1);
      }
      userList.push(entry);
    } else if (online) {
      online.staffDisableVisibleElo = settings.staffDisableVisibleElo;
      online.staffDisableVisibleXP = settings.staffDisableVisibleXP;
      online.staffDisableStaffColor = settings.staffDisableStaffColor;
    }

    socket.emit('gameSettings', settings);
    sendUserList();
  } catch (error) {
    log.error({ err: error, user: caller.username }, 'saving game settings failed');
  }
}

export async function handleUpdatedBio(_socket: HubSocket, caller: Caller, raw: unknown): Promise<void> {
  const parsed = bioInput.safeParse(raw);
  if (!parsed.success) return;
  try {
    await saveBioForRealtime(caller.username, parsed.data);
  } catch (error) {
    log.error({ err: error, user: caller.username }, 'saving bio failed');
  }
}

export async function handleUpdatedTheme(_socket: HubSocket, caller: Caller, raw: unknown): Promise<void> {
  const parsed = themeInput.safeParse(raw);
  if (!parsed.success) return;
  try {
    await saveThemeForRealtime(caller.username, parsed.data);
  } catch (error) {
    log.error({ err: error, user: caller.username }, 'saving theme failed');
  }
}

/** The new-player welcome popup was closed; the client then asks for its restrictions again. */
export async function handleHasSeenNewPlayerModal(socket: HubSocket, caller: Caller): Promise<void> {
  try {
    await dismissSignupModalForRealtime(caller.username);
    socket.emit('checkRestrictions');
  } catch (error) {
    log.error({ err: error, user: caller.username }, 'dismissing the new-player modal failed');
  }
}
