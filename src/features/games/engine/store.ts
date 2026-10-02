/**
 * The engine's in-memory state: live games, who is online, the general chat.
 *
 * One object per process, parked on `globalThis` under a registered symbol.
 * The custom server (Socket.IO handlers, loaded by tsx) and Next's bundled
 * route handlers each get their own copy of this *module*; the symbol makes
 * them share one *state*. It also survives dev hot reloads, like the legacy
 * process kept its games across nothing — a restart still drops everything.
 */

export type OnlineUser = {
  userName: string;
  [key: string]: unknown;
};

export type EngineStore = {
  /** Connected, signed-in players (legacy `userList`). */
  userList: OnlineUser[];
};

const KEY = Symbol.for('grand-mafia.engine-store');

function createStore(): EngineStore {
  return { userList: [] };
}

export function engineStore(): EngineStore {
  const holder = globalThis as unknown as Record<symbol, EngineStore | undefined>;
  return (holder[KEY] ??= createStore());
}
