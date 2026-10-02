import { engineStore, setHub } from '@/features/games/engine/store';
import type { Hub, HubSocket } from '@/features/games/engine/hub';
import type { StaffRole } from '@/lib/prisma-enums';

/**
 * An in-memory Socket.IO: every socket records what it was sent, rooms are
 * sets, and a broadcast reaches the sockets in the room. Enough for the
 * engine, which only knows the `Hub` interface.
 */

export type Emitted = { event: string; args: unknown[] };

export class FakeSocket implements HubSocket {
  readonly emitted: Emitted[] = [];
  readonly rooms = new Set<string>();
  connected = true;

  constructor(
    private readonly hub: FakeHub,
    readonly id: string,
    readonly username: string | null,
    readonly staffRole: StaffRole | null
  ) {}

  emit(event: string, ...args: unknown[]): void {
    this.emitted.push({ event, args });
  }

  join(room: string): void {
    this.rooms.add(room);
  }

  leave(room: string): void {
    this.rooms.delete(room);
  }

  leaveAllRooms(): void {
    this.rooms.clear();
  }

  disconnect(): void {
    this.connected = false;
    this.rooms.clear();
    this.hub.remove(this);
  }

  /** Everything received under `event`, oldest first (the first argument of each). */
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

export class FakeHub implements Hub {
  private sockets: FakeSocket[] = [];
  private counter = 0;

  connect(username: string | null, staffRole: StaffRole | null = null): FakeSocket {
    const socket = new FakeSocket(this, `sock-${(this.counter += 1)}`, username, staffRole);
    this.sockets.push(socket);
    return socket;
  }

  remove(socket: FakeSocket): void {
    this.sockets = this.sockets.filter((candidate) => candidate !== socket);
  }

  allSockets(): FakeSocket[] {
    return [...this.sockets];
  }

  socketsInRoom(room: string): FakeSocket[] {
    return this.sockets.filter((socket) => socket.rooms.has(room));
  }

  emitAll(event: string, ...args: unknown[]): void {
    for (const socket of this.sockets) socket.emit(event, ...args);
  }

  emitRoom(room: string, event: string, ...args: unknown[]): void {
    for (const socket of this.socketsInRoom(room)) socket.emit(event, ...args);
  }
}

const STORE_KEY = Symbol.for('secret-hitler.engine-store');

/** A new, empty engine wired to a new fake hub. Call at the start of every test. */
export function resetEngine(): FakeHub {
  delete (globalThis as Record<symbol, unknown>)[STORE_KEY];
  const hub = new FakeHub();
  setHub(hub);
  engineStore();
  return hub;
}
