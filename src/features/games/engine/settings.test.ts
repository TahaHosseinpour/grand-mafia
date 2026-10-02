import { beforeEach, describe, expect, it, vi } from 'vitest';
import { resetEngine, type FakeSocket } from '@/test/fake-hub';
import { world } from '@/test/world';
import { findOnlineUser } from './lists';
import { sendUserGameSettings } from './presence';
import { handleUpdatedBio, handleUpdatedGameSettings } from './settings';

async function connect(username: string, staffRole: Parameters<typeof world.addAccount>[1] = {}): Promise<FakeSocket> {
  const hub = resetEngine();
  world.addAccount(username, staffRole);
  const socket = hub.connect(username, staffRole.staffRole ?? null);
  await sendUserGameSettings(socket);
  socket.clear();
  return socket;
}

const update = (socket: FakeSocket, payload: unknown) => handleUpdatedGameSettings(socket, { username: socket.username as string }, payload);

describe('game settings', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  it('saves a setting a player may change and sends the new settings back', async () => {
    const socket = await connect('sara');

    await update(socket, { fontSize: 18, disableConfetti: true });

    expect(world.account('sara').gameSettings).toMatchObject({ fontSize: 18, disableConfetti: true });
    expect(socket.lastReceived('gameSettings')).toMatchObject({ fontSize: 18 });
  });

  it('ignores settings a player may not change', async () => {
    const socket = await connect('sara');

    await update(socket, { fontSize: 14, staffIncognito: true, unbanTime: 'never', ignoreIPBans: true, customCardback: 'x.png', isRainbow: true });

    const saved = world.account('sara').gameSettings;
    expect(saved.fontSize).toBe(14);
    expect(saved).not.toHaveProperty('staffIncognito');
    expect(saved).not.toHaveProperty('unbanTime');
    expect(saved).not.toHaveProperty('ignoreIPBans');
    expect(saved).not.toHaveProperty('customCardback');
    expect(saved).not.toHaveProperty('isRainbow');
  });

  it('lets a moderator go incognito and hides them from the online list', async () => {
    const socket = await connect('modi', { staffRole: 'moderator' });
    expect(findOnlineUser('modi')?.staffIncognito).toBeFalsy();

    await update(socket, { staffIncognito: true });

    expect(world.account('modi').gameSettings.staffIncognito).toBe(true);
    expect(findOnlineUser('modi')?.staffIncognito).toBe(true);
  });

  it('does not let a trial moderator go incognito', async () => {
    const socket = await connect('trial', { staffRole: 'trialmod' });

    await update(socket, { staffIncognito: true });

    expect(world.account('trial').gameSettings).not.toHaveProperty('staffIncognito');
  });

  it('keeps the last 30 blacklist entries and drops a malformed list', async () => {
    const socket = await connect('sara');
    const entries = Array.from({ length: 40 }, (_, i) => ({ userName: `p${i}`, reason: 'rude', timestamp: i }));

    await update(socket, { blacklist: entries });
    expect(world.account('sara').gameSettings.blacklist).toHaveLength(30);
    expect(world.account('sara').gameSettings.blacklist?.[0].userName).toBe('p10');
    expect(findOnlineUser('sara')?.blacklist).toHaveLength(30);

    await update(socket, { blacklist: [{ userName: 5 }] });
    expect(world.account('sara').gameSettings.blacklist).toHaveLength(30);
  });

  it('accepts only the listed pronouns', async () => {
    const socket = await connect('sara');

    await update(socket, { playerPronouns: 'she/her/hers' });
    expect(world.account('sara').gameSettings.playerPronouns).toBe('she/her/hers');
    expect(findOnlineUser('sara')?.playerPronouns).toBe('she/her/hers');

    await update(socket, { playerPronouns: 'anything I like' });
    expect(world.account('sara').gameSettings.playerPronouns).toBe('she/her/hers');
  });

  it('ignores a payload that is not an object', async () => {
    const socket = await connect('sara');

    await update(socket, 'fontSize');
    await update(socket, null);

    expect(world.account('sara').gameSettings).toEqual({});
    expect(socket.got('gameSettings')).toBe(false);
  });

  describe('private profile', () => {
    it('switches on, reconnecting the player, and stamps the time', async () => {
      const socket = await connect('sara');

      await update(socket, { isPrivate: true });

      expect(world.account('sara').gameSettings.isPrivate).toBe(true);
      expect(world.account('sara').gameSettings.privateToggleTime).toBe(Date.now());
      expect(socket.got('manualDisconnection')).toBe(true);
    });

    it('refuses to switch back within 18 hours', async () => {
      const socket = await connect('sara');
      await update(socket, { isPrivate: true });
      socket.clear();

      vi.advanceTimersByTime(17 * 60 * 60 * 1000);
      await update(socket, { isPrivate: false });

      expect(world.account('sara').gameSettings.isPrivate).toBe(true);
      expect(socket.got('manualDisconnection')).toBe(false);
      expect(socket.lastReceived('gameSettings')).toMatchObject({ isPrivate: true });
    });

    it('switches back after 18 hours', async () => {
      const socket = await connect('sara');
      await update(socket, { isPrivate: true });

      vi.advanceTimersByTime(19 * 60 * 60 * 1000);
      await update(socket, { isPrivate: false });

      expect(world.account('sara').gameSettings.isPrivate).toBe(false);
    });

    it('is not switched off by saving some other setting', async () => {
      const socket = await connect('sara');
      await update(socket, { isPrivate: true });
      vi.advanceTimersByTime(20 * 60 * 60 * 1000);

      await update(socket, { fontSize: 16 });

      expect(world.account('sara').gameSettings.isPrivate).toBe(true);
    });
  });
});

describe('bio', () => {
  it('saves a bio and ignores one that is too long or not text', async () => {
    const socket = await connect('sara');
    const caller = { username: 'sara' };

    await handleUpdatedBio(socket, caller, 'سلام! من سارا هستم.');
    expect(world.account('sara').bio).toBe('سلام! من سارا هستم.');

    await handleUpdatedBio(socket, caller, 'x'.repeat(501));
    await handleUpdatedBio(socket, caller, { bio: 'no' });
    expect(world.account('sara').bio).toBe('سلام! من سارا هستم.');
  });
});
