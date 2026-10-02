import { useSyncExternalStore } from 'react';
import type { GameInfo, GameListItem, GeneralChats, TouChange, UserInfo, UserListItem, VersionInfo, WarningPopup } from './wire';

/**
 * The game client's state (legacy redux store: `userInfo`, `midSection`,
 * `gameList`, `gameInfo`, `userList`, `generalChats`, `version`…). One small
 * external store read with `useSyncExternalStore`; socket events write it,
 * components select what they draw.
 *
 * Selectors must return a value already in the state (or a primitive), never
 * a new object, or the component re-renders forever.
 */

export type MidSection =
  | 'default'
  | 'game'
  | 'createGame'
  | 'settings'
  | 'profile'
  | 'leaderboards'
  | 'changelog';

export type Popup =
  | { type: 'tou'; changes: TouChange[] }
  | { type: 'warning'; warning: WarningPopup }
  | null;

export type ClientState = {
  userInfo: UserInfo;
  midSection: MidSection;
  /** The profile shown when `midSection` is `profile`. */
  profileName: string | null;
  gameList: GameListItem[];
  gameInfo: GameInfo | null;
  userList: UserListItem[];
  generalChats: GeneralChats;
  version: VersionInfo | null;
  allEmotes: Record<string, string>;
  popup: Popup;
  /** Messages the server sent with `sendAlert` (shown one at a time). */
  alerts: string[];
  notesActive: boolean;
  /** The seat whose player notes are open (legacy `playerNotesActive`). */
  playerNotesActive: string;
  /** Phones: which lobby panel is showing. */
  lobbyTab: 'games' | 'chat' | 'players';
  /** Phones: the table or its chat. */
  tableTab: 'board' | 'chat';
  /** Game-chat lines the player has not looked at yet (the badge on the chat tab). */
  unreadGameChat: number;
  connected: boolean;
};

const empty: ClientState = {
  userInfo: {},
  midSection: 'default',
  profileName: null,
  gameList: [],
  gameInfo: null,
  userList: [],
  generalChats: { sticky: '', list: [] },
  version: null,
  allEmotes: {},
  popup: null,
  alerts: [],
  notesActive: false,
  playerNotesActive: '',
  lobbyTab: 'games',
  tableTab: 'board',
  unreadGameChat: 0,
  connected: false,
};

let state: ClientState = empty;
const listeners = new Set<() => void>();

export function getState(): ClientState {
  return state;
}

/** Replaces part of the state and tells every subscriber. */
export function setState(patch: Partial<ClientState> | ((current: ClientState) => Partial<ClientState>)): void {
  const next = typeof patch === 'function' ? patch(state) : patch;
  state = { ...state, ...next };
  for (const listener of listeners) listener();
}

/** A fresh state for a page load: the signed-in player, or an observer. */
export function resetState(userInfo: UserInfo): void {
  state = { ...empty, userInfo };
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useClientState<T>(selector: (state: ClientState) => T): T {
  return useSyncExternalStore(
    subscribe,
    () => selector(state),
    () => selector(state)
  );
}
