'use client';

import { Gamepad2, MessagesSquare, Users } from 'lucide-react';
import { formatNumber } from '@/lib/datetime';
import { cn } from '@/lib/utils';
import { setState, useClientState } from '../store';
import GamesPanel from './games-panel';
import GeneralChat from './general-chat';
import OnlinePlayers from './online-players';

/**
 * The lobby. On a phone one panel at a time — games, chat, players — with a
 * tab bar at the bottom; from `lg` up, all three side by side.
 */

const TABS = [
  { key: 'games', label: 'بازی‌ها', icon: Gamepad2 },
  { key: 'chat', label: 'چت', icon: MessagesSquare },
  { key: 'players', label: 'بازیکنان', icon: Users },
] as const;

function BottomTabs() {
  const tab = useClientState((state) => state.lobbyTab);
  const online = useClientState((state) => state.userList.length);
  return (
    <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-surface/95 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden" aria-label="بخش‌های لابی">
      <div className="mx-auto grid max-w-lg grid-cols-3">
        {TABS.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            type="button"
            onClick={() => setState({ lobbyTab: key })}
            aria-current={tab === key ? 'page' : undefined}
            className={cn('flex cursor-pointer flex-col items-center gap-0.5 py-2 text-[0.75rem] font-bold', tab === key ? 'text-accent-strong' : 'text-fg-faint')}
          >
            <span className="relative">
              <Icon className="size-6" />
              {key === 'players' && online ? (
                <span className="absolute -end-3 -top-1.5 rounded-full bg-surface-3 px-1 text-[0.65rem] leading-4 text-fg-muted">{formatNumber(online)}</span>
              ) : null}
            </span>
            {label}
          </button>
        ))}
      </div>
    </nav>
  );
}

export default function LobbyScreen() {
  const tab = useClientState((state) => state.lobbyTab);
  const panelHeight = 'h-[calc(100dvh-3.5rem-4.25rem-env(safe-area-inset-bottom))] lg:h-[calc(100dvh-3.5rem-2rem)]';

  return (
    <div className="mx-auto max-w-[1400px] px-4 pt-4 lg:grid lg:grid-cols-[260px_minmax(0,1fr)_360px] lg:gap-5">
      <OnlinePlayers className={cn(panelHeight, tab === 'players' ? 'block' : 'hidden', 'lg:block')} />
      <GamesPanel className={cn(panelHeight, tab === 'games' ? 'flex' : 'hidden', 'lg:flex')} />
      <GeneralChat className={cn(panelHeight, 'pb-3 lg:pb-0', tab === 'chat' ? 'flex' : 'hidden', 'lg:flex')} />
      <BottomTabs />
    </div>
  );
}
