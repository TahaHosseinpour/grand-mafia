'use client';

import { useEffect, useState } from 'react';
import { Spinner } from '@/components/ui/spinner';
import LobbyScreen from '../lobby/lobby-screen';
import CreateGameScreen from '../create/create-game-screen';
import TableScreen from '../table/table-screen';
import SettingsScreen from '../settings/settings-screen';
import ProfileScreen from '../profile/profile-screen';
import { resetState, useClientState } from '../store';
import type { UserInfo } from '../wire';
import AppHeader from './app-header';
import Popups from './popups';
import { useHashRouter } from './use-hash-router';
import { useSocketEvents } from './use-socket-events';

/**
 * The game client: one page (`/game`, or `/observe` for visitors) whose
 * screens are hash routes, fed by one Socket.IO connection.
 */

function ComingSoon({ title, text }: { title: string; text: string }) {
  return (
    <div className="mx-auto max-w-md px-6 py-16 text-center">
      <h1 className="font-display text-[2rem]">{title}</h1>
      <p className="mt-2 text-fg-muted">{text}</p>
      <a href="#/" className="mt-6 inline-block text-accent-strong underline">
        بازگشت به لابی
      </a>
    </div>
  );
}

function Screen() {
  const midSection = useClientState((state) => state.midSection);
  const hasGame = useClientState((state) => Boolean(state.gameInfo));

  switch (midSection) {
    case 'game':
      return hasGame ? (
        <TableScreen />
      ) : (
        <div className="flex justify-center py-24">
          <Spinner />
        </div>
      );
    case 'createGame':
      return <CreateGameScreen />;
    case 'settings':
      return <SettingsScreen />;
    case 'profile':
      return <ProfileScreen />;
    case 'leaderboards':
      return <ComingSoon title="جدول رده‌بندی" text="جدول رده‌بندی به‌زودی اضافه می‌شود." />;
    case 'changelog':
      return <ComingSoon title="تازه‌ها" text="فهرست تغییرات به‌زودی اضافه می‌شود." />;
    default:
      return <LobbyScreen />;
  }
}

export default function GameClient({ user }: { user: UserInfo | null }) {
  // The store starts from what the server rendered with, before any child reads it.
  useState(() => {
    resetState(user ?? {});
    return true;
  });
  useSocketEvents();
  useHashRouter();
  const safeForWork = useClientState((state) => Boolean(state.userInfo.gameSettings?.safeForWork));
  useEffect(() => {
    document.title = safeForWork ? 'بازی' : 'هیتلر مخفی';
  }, [safeForWork]);

  return (
    <div className="min-h-dvh bg-ink text-fg">
      <AppHeader />
      <main>
        <Screen />
      </main>
      <Popups />
    </div>
  );
}
