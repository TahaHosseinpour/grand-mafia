import { describe, expect, it, vi } from 'vitest';
import { resetEngine } from '@/test/fake-hub';
import { world } from '@/test/world';
import { admitConnection } from './connection';
import { findOnlineUser } from './lists';
import { sendUserGameSettings } from './presence';

describe('admitting a connection', () => {
  it('admits an observer without touching anything', async () => {
    const hub = resetEngine();
    const observer = hub.connect(null);

    expect(await admitConnection(observer)).toBe(true);
    expect(observer.emitted).toHaveLength(0);
  });

  it('admits a player in good standing', async () => {
    const hub = resetEngine();
    world.addAccount('sara');

    expect(await admitConnection(hub.connect('sara'))).toBe(true);
  });

  it('closes the older connection when the same player connects again', async () => {
    const hub = resetEngine();
    world.addAccount('sara');
    const first = hub.connect('sara');
    const second = hub.connect('sara');

    expect(await admitConnection(second)).toBe(true);

    expect(first.got('manualDisconnection')).toBe(true);
    expect(first.connected).toBe(false);
    expect(second.connected).toBe(true);
    expect(hub.allSockets()).toEqual([second]);
  });

  it('turns away a banned player, and takes them off the online list', async () => {
    const hub = resetEngine();
    world.addAccount('troll');
    await sendUserGameSettings(hub.connect('troll'));
    expect(findOnlineUser('troll')).toBeDefined();

    world.account('troll').isBanned = true;
    const socket = hub.connect('troll');

    expect(await admitConnection(socket)).toBe(false);
    expect(socket.got('manualDisconnection')).toBe(true);
    expect(socket.connected).toBe(false);
    expect(findOnlineUser('troll')).toBeUndefined();
  });

  it('turns away a player in timeout until it ends', async () => {
    vi.useFakeTimers();
    const hub = resetEngine();
    world.addAccount('sara', { timeoutUntil: new Date(Date.now() + 60_000).toISOString() });

    expect(await admitConnection(hub.connect('sara'))).toBe(false);

    vi.advanceTimersByTime(61_000);
    expect(await admitConnection(hub.connect('sara'))).toBe(true);
  });

  it('turns away a player whose address is banned, unless the ban is only for new accounts', async () => {
    const hub = resetEngine();
    world.addAccount('sara', { lastConnectedIp: '198.51.100.9' });
    world.ipBans.set('198.51.100.9', { type: 'big', until: null, permanent: true });

    expect(await admitConnection(hub.connect('sara'))).toBe(false);

    world.ipBans.set('198.51.100.9', { type: 'new', until: null, permanent: false });
    expect(await admitConnection(hub.connect('sara'))).toBe(true);
  });

  it('lets a player marked to ignore IP bans in', async () => {
    const hub = resetEngine();
    world.addAccount('sara', { lastConnectedIp: '198.51.100.9', gameSettings: { ignoreIPBans: true } });
    world.ipBans.set('198.51.100.9', { type: 'big', until: null, permanent: true });

    expect(await admitConnection(hub.connect('sara'))).toBe(true);
  });
});
