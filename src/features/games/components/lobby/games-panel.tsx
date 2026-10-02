'use client';

import { Bell, Plus, SlidersHorizontal } from 'lucide-react';
import { useState } from 'react';
import { Button, buttonClasses } from '@/components/ui/button';
import { Modal } from '@/components/ui/modal';
import { Switch } from '@/components/ui/switch';
import { formatNumber } from '@/lib/datetime';
import { cn } from '@/lib/utils';
import { emit } from '../socket';
import { setState, useClientState } from '../store';
import GameCard from './game-card';
import { FILTERS, isHidden, sortGames, type GameFilterKey } from './game-list';

/** The list of tables, its filters and the «new game» button. */

function FilterSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const settings = useClientState((state) => state.userInfo.gameSettings);
  const filters = settings?.gameFilters ?? {};

  const save = (patch: Record<string, unknown>) => {
    setState((state) => ({ userInfo: { ...state.userInfo, gameSettings: { ...state.userInfo.gameSettings, ...patch } } }));
    emit('updateGameSettings', patch);
  };
  const toggle = (key: GameFilterKey, show: boolean) => save({ gameFilters: { ...filters, [key]: !show } });

  return (
    <Modal open={open} onClose={onClose} title="نمایش بازی‌ها">
      <p className="-mt-2 mb-2 text-[0.9rem] text-fg-muted">کدام بازی‌ها در فهرست باشند؟ انتخاب‌ها برای دفعه‌های بعد ذخیره می‌شود.</p>
      <div className="grid grid-cols-1 divide-y divide-line sm:grid-cols-2 sm:gap-x-6 sm:divide-y-0">
        {FILTERS.map(({ key, label }) => (
          <Switch key={key} label={label} checked={!filters[key]} onChange={(show) => toggle(key, show)} />
        ))}
      </div>
      <div className="mt-3 border-t border-line pt-2">
        <Switch
          label={
            <span className="flex items-center gap-2">
              <Bell className="size-4 text-fg-muted" /> خبرم کن وقتی بازی تازه‌ای ساخته شد
            </span>
          }
          checked={Boolean(settings?.notifyForNewLobby)}
          onChange={(notify) => {
            if (notify && 'Notification' in window && Notification.permission === 'default') void Notification.requestPermission();
            save({ notifyForNewLobby: notify });
          }}
        />
      </div>
    </Modal>
  );
}

export default function GamesPanel({ className }: { className?: string }) {
  const gameList = useClientState((state) => state.gameList);
  const userName = useClientState((state) => state.userInfo.userName);
  const filters = useClientState((state) => state.userInfo.gameSettings?.gameFilters);
  const me = useClientState((state) => state.userList.find((user) => user.userName === state.userInfo.userName));
  const [filtersOpen, setFiltersOpen] = useState(false);

  const visible = sortGames(
    gameList.filter((game) => !isHidden(game, filters)),
    me
  );
  const hiddenCount = gameList.length - visible.length;

  return (
    <section className={cn('flex min-h-0 flex-col', className)} aria-label="بازی‌ها">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h2 className="font-display text-[1.6rem] leading-none">
          بازی‌ها <span className="text-[1.1rem] text-fg-faint">{formatNumber(visible.length)}</span>
        </h2>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={() => setFiltersOpen(true)} aria-label="فیلترها">
            <SlidersHorizontal className="size-5" />
            <span className="hidden sm:inline">فیلترها</span>
          </Button>
          {userName ? (
            <a href="#/creategame" className={buttonClasses({ variant: 'primary', size: 'sm', className: 'hidden text-white hover:text-white lg:inline-flex' })}>
              <Plus className="size-5" /> بازی جدید
            </a>
          ) : null}
        </div>
      </div>

      <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto pb-24 lg:pb-4">
        {visible.map((game) => (
          <GameCard key={game.uid} game={game} mine={Boolean(userName && game.userNames.includes(userName))} />
        ))}
        {visible.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-line px-6 py-12 text-center">
            <p className="font-display text-[1.4rem] text-fg-muted">میزی باز نیست</p>
            <p className="mt-1 text-fg-faint">
              {hiddenCount > 0 ? `${formatNumber(hiddenCount)} بازی با فیلترهای شما پنهان شده است.` : userName ? 'اولین میز را شما بچینید!' : 'برای ساختن بازی وارد شوید.'}
            </p>
          </div>
        ) : null}
      </div>

      {userName ? (
        <a
          href="#/creategame"
          className={buttonClasses({
            variant: 'primary',
            size: 'lg',
            className: 'fixed inset-x-4 bottom-[calc(4.5rem+env(safe-area-inset-bottom))] z-30 text-white hover:text-white lg:hidden',
          })}
        >
          <Plus className="size-6" /> بازی جدید
        </a>
      ) : null}

      <FilterSheet open={filtersOpen} onClose={() => setFiltersOpen(false)} />
    </section>
  );
}
