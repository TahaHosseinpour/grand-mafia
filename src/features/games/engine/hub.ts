import type { StaffRole } from '@/lib/prisma-enums';

/**
 * What the engine needs from Socket.IO — nothing more. The realtime layer
 * (`src/realtime`) implements this over real sockets; tests implement it in
 * memory. Keeping the engine behind this interface is what lets the whole
 * game run, timers included, without a network.
 */

export interface HubSocket {
  readonly id: string;
  /** The signed-in user behind this connection, or null for an observer. */
  readonly username: string | null;
  readonly staffRole: StaffRole | null;
  emit(event: string, ...args: unknown[]): void;
  join(room: string): void;
  leave(room: string): void;
  leaveAllRooms(): void;
  disconnect(): void;
}

export interface Hub {
  allSockets(): HubSocket[];
  socketsInRoom(room: string): HubSocket[];
  emitAll(event: string, ...args: unknown[]): void;
  emitRoom(room: string, event: string, ...args: unknown[]): void;
}

/** A hub with nobody connected; used until the realtime layer installs the real one. */
export const nullHub: Hub = {
  allSockets: () => [],
  socketsInRoom: () => [],
  emitAll: () => undefined,
  emitRoom: () => undefined,
};
