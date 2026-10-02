import { engineStore, setHub } from '@/features/games/engine/store';
import { createHub, type GameServer, type GameSocket } from '@/realtime/hub';
import type { Actor } from '@/server/socket-auth';

/**
 * A Socket.IO stand-in with the parts the realtime layer touches: sockets
 * with listeners and packet middleware, rooms, and the server's `emit` / `to`.
 * `receive()` plays the client sending an event: through the middleware first,
 * as Socket.IO does, then to the listeners.
 */

type Listener = (...args: unknown[]) => unknown;
type Middleware = (packet: unknown[], next: () => void) => void;

export class FakeIoSocket {
  readonly emitted: { event: string; args: unknown[] }[] = [];
  readonly rooms: Set<string>;
  readonly data: { actor: Actor | null };
  readonly nsp: { sockets: Map<string, FakeIoSocket> };
  connected = true;
  private readonly listeners = new Map<string, Listener[]>();
  private readonly middleware: Middleware[] = [];

  constructor(
    private readonly io: FakeIo,
    readonly id: string,
    actor: Actor | null
  ) {
    this.data = { actor };
    this.rooms = new Set([id]);
    this.nsp = { sockets: io.sockets.sockets };
  }

  on(event: string, listener: Listener): this {
    this.listeners.set(event, [...(this.listeners.get(event) ?? []), listener]);
    return this;
  }

  use(middleware: Middleware): this {
    this.middleware.push(middleware);
    return this;
  }

  emit(event: string, ...args: unknown[]): boolean {
    this.emitted.push({ event, args });
    return true;
  }

  join(room: string): void {
    this.rooms.add(room);
    this.io.addToRoom(room, this.id);
  }

  leave(room: string): void {
    this.rooms.delete(room);
    this.io.removeFromRoom(room, this.id);
  }

  disconnect(): this {
    if (!this.connected) return this;
    this.connected = false;
    this.io.sockets.sockets.delete(this.id);
    for (const room of this.rooms) this.io.removeFromRoom(room, this.id);
    this.rooms.clear();
    this.fire('disconnect');
    return this;
  }

  /** The client sends `event` with `args`. Resolves once the handlers have settled. */
  async receive(event: string, ...args: unknown[]): Promise<void> {
    const packet = [event, ...args];
    let passed = true;
    for (const middleware of this.middleware) {
      let advanced = false;
      middleware(packet, () => {
        advanced = true;
      });
      if (!advanced) {
        passed = false;
        break;
      }
    }
    if (passed) this.fire(event, ...args);
    // Handlers are async (they wait for the connection to be admitted and for the data layer).
    // Counting microtasks rather than waiting on a timer keeps this working under fake timers.
    for (let i = 0; i < 100; i++) await Promise.resolve();
  }

  /** Server-side event delivery, for 'disconnect'. */
  fire(event: string, ...args: unknown[]): void {
    for (const listener of this.listeners.get(event) ?? []) void listener(...args);
  }

  received(event: string): unknown[] {
    return this.emitted.filter((entry) => entry.event === event).map((entry) => entry.args[0]);
  }

  lastReceived(event: string): unknown {
    const all = this.received(event);
    return all[all.length - 1];
  }

  got(event: string): boolean {
    return this.emitted.some((entry) => entry.event === event);
  }

  clear(): void {
    this.emitted.length = 0;
  }
}

export class FakeIo {
  readonly sockets: { sockets: Map<string, FakeIoSocket>; adapter: { rooms: Map<string, Set<string>> } };
  private counter = 0;

  constructor() {
    this.sockets = { sockets: new Map(), adapter: { rooms: new Map() } };
  }

  /** A browser connecting; `actor` is what the handshake resolved from its cookie. */
  connect(actor: Actor | null): FakeIoSocket {
    const socket = new FakeIoSocket(this, `io-${(this.counter += 1)}`, actor);
    this.sockets.sockets.set(socket.id, socket);
    return socket;
  }

  addToRoom(room: string, id: string): void {
    const members = this.sockets.adapter.rooms.get(room) ?? new Set<string>();
    members.add(id);
    this.sockets.adapter.rooms.set(room, members);
  }

  removeFromRoom(room: string, id: string): void {
    const members = this.sockets.adapter.rooms.get(room);
    members?.delete(id);
    if (members && members.size === 0) this.sockets.adapter.rooms.delete(room);
  }

  emit(event: string, ...args: unknown[]): boolean {
    for (const socket of this.sockets.sockets.values()) socket.emit(event, ...args);
    return true;
  }

  to(room: string): { emit: (event: string, ...args: unknown[]) => boolean } {
    return {
      emit: (event, ...args) => {
        for (const id of this.sockets.adapter.rooms.get(room) ?? []) this.sockets.sockets.get(id)?.emit(event, ...args);
        return true;
      },
    };
  }
}

const STORE_KEY = Symbol.for('secret-hitler.engine-store');

/** A new, empty engine whose hub is a fake Socket.IO server. */
export function resetRealtime(): FakeIo {
  delete (globalThis as Record<symbol, unknown>)[STORE_KEY];
  const io = new FakeIo();
  setHub(createHub(io as unknown as GameServer));
  engineStore();
  return io;
}

export const asGameSocket = (socket: FakeIoSocket): GameSocket => socket as unknown as GameSocket;

export const actorOf = (username: string, staffRole: Actor['staffRole'] = null, userId = 1): Actor => ({ userId, username, staffRole, verified: true });
