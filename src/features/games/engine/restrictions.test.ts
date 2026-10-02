import { beforeEach, describe, expect, it, vi } from 'vitest';
import { LATEST_TOU_VERSION } from '@/lib/tou';
import { resetEngine, type FakeSocket } from '@/test/fake-hub';
import { world } from '@/test/world';
import { acknowledgeWarning, checkRestriction, confirmTerms, handleFeedbackForm } from './restrictions';

function connect(username: string, overrides: Parameters<typeof world.addAccount>[1] = {}): FakeSocket {
  const hub = resetEngine();
  world.addAccount(username, overrides);
  return hub.connect(username);
}

const warn = (username: string, text: string) => {
  const list = world.warnings.get(username) ?? [];
  list.push({ id: list.length + 1, text, time: new Date().toISOString(), acknowledged: false });
  world.warnings.set(username, list);
};

describe('restrictions', () => {
  it('lets a player who agreed to the terms and has no warnings play', async () => {
    const socket = connect('sara');

    expect(await checkRestriction(socket)).toBe(false);
    expect(socket.got('removeAllPopups')).toBe(true);
    expect(socket.got('touChange')).toBe(false);
  });

  it('shows a new player the basic rules until they agree', async () => {
    const socket = connect('sara', { touLastAgreed: null });

    expect(await checkRestriction(socket)).toBe(true);
    const shown = socket.lastReceived('touChange') as { changeVer: string }[];
    expect(shown).toHaveLength(1);
    expect(shown[0].changeVer).toBe('0.0');

    expect(await confirmTerms(socket)).toBe(false);
    expect(world.account('sara').touLastAgreed).toBe(LATEST_TOU_VERSION);
  });

  it('shows a returning player what changed since they last agreed', async () => {
    const socket = connect('sara', { touLastAgreed: '1.3' });

    expect(await checkRestriction(socket)).toBe(true);
    expect((socket.lastReceived('touChange') as { changeVer: string }[]).map((c) => c.changeVer)).toEqual(['1.5', '1.4']);
  });

  it('shows warnings one at a time after the terms, without the moderator who gave them', async () => {
    const socket = connect('sara');
    warn('sara', 'first');
    warn('sara', 'second');

    expect(await checkRestriction(socket)).toBe(true);
    const popup = socket.lastReceived('warningPopup') as Record<string, unknown>;
    expect(popup.text).toBe('first');
    expect(popup).not.toHaveProperty('moderator');

    expect(await acknowledgeWarning(socket)).toBe(true);
    expect((socket.lastReceived('warningPopup') as { text: string }).text).toBe('second');

    expect(await acknowledgeWarning(socket)).toBe(false);
    expect(socket.got('removeAllPopups')).toBe(true);
  });

  it('asks for the terms before showing warnings', async () => {
    const socket = connect('sara', { touLastAgreed: '1.0' });
    warn('sara', 'careful');

    await checkRestriction(socket);

    expect(socket.got('touChange')).toBe(true);
    expect(socket.got('warningPopup')).toBe(false);
  });

  it('does not restrict an observer', async () => {
    const hub = resetEngine();
    const observer = hub.connect(null);

    expect(await checkRestriction(observer)).toBe(false);
    expect(observer.emitted).toHaveLength(0);
  });
});

describe('feedback', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  const send = async (socket: FakeSocket, feedback: unknown) => {
    socket.clear();
    await handleFeedbackForm(socket, { feedback });
    return socket.lastReceived('feedbackResponse') as { status: string; message: string };
  };

  it('stores feedback and thanks the player', async () => {
    const socket = connect('sara');

    expect((await send(socket, 'عالی بود')).status).toBe('success');
    expect(world.feedback).toHaveLength(1);
    expect(world.feedback[0]).toMatchObject({ username: 'sara', text: 'عالی بود' });
  });

  it('refuses empty and too long feedback', async () => {
    const socket = connect('sara');

    expect((await send(socket, '')).status).toBe('error');
    expect((await send(socket, 'x'.repeat(1901))).status).toBe('error');
    expect(world.feedback).toHaveLength(0);
  });

  it('refuses an observer', async () => {
    const hub = resetEngine();
    const observer = hub.connect(null);

    await handleFeedbackForm(observer, { feedback: 'hi' });

    expect((observer.lastReceived('feedbackResponse') as { status: string }).status).toBe('error');
    expect(world.feedback).toHaveLength(0);
  });

  it('allows two a day and tells the player how long to wait for the third', async () => {
    const socket = connect('sara');

    expect((await send(socket, 'one')).status).toBe('success');
    vi.advanceTimersByTime(60 * 60 * 1000);
    expect((await send(socket, 'two')).status).toBe('success');
    vi.advanceTimersByTime(60 * 60 * 1000);

    const third = await send(socket, 'three');
    expect(third.status).toBe('error');
    expect(third.message).toContain('ساعت');
    expect(world.feedback).toHaveLength(2);

    // 24 hours after the second most recent one, it is open again.
    vi.advanceTimersByTime(23 * 60 * 60 * 1000);
    expect((await send(socket, 'three')).status).toBe('success');
  });
});
