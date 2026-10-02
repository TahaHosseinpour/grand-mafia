'use client';

import { ChevronDown, Eye, Gamepad2, Lock, Rainbow } from 'lucide-react';
import { useState } from 'react';
import { formatNumber } from '@/lib/datetime';
import { cn } from '@/lib/utils';
import { playerColor } from '../common/player-color';
import { useClientState } from '../store';
import type { UserListItem } from '../wire';

/**
 * Who is online (legacy Playerlist.jsx), grouped the same way: staff,
 * contributors, experienced (rainbow) and new players, each sorted by rating.
 */

const isStaff = (user: UserListItem) => Boolean(user.staffRole && user.staffRole !== 'veteran' && user.staffRole !== 'altmod' && user.staffRole !== 'trialmod' && user.staffRole !== 'contributor');

function Status({ user }: { user: UserListItem }) {
  const status = user.status;
  if (!status || !status.gameId) return null;
  const icon =
    status.type === 'observing' ? <Eye className="size-4" /> : status.type === 'private' ? <Lock className="size-4" /> : status.type === 'rainbow' ? <Rainbow className="size-4" /> : <Gamepad2 className="size-4" />;
  const label = status.type === 'observing' ? 'در حال تماشا' : status.type === 'private' ? 'در بازی خصوصی' : 'در حال بازی';
  return (
    <a href={`#/table/${status.gameId}`} title={label} aria-label={label} className="text-fg-faint hover:text-accent-strong">
      {icon}
    </a>
  );
}

function Group({ title, users, seasonal, eloHidden }: { title: string; users: UserListItem[]; seasonal: boolean; eloHidden?: boolean }) {
  const [open, setOpen] = useState(true);
  if (!users.length) return null;
  return (
    <div className="mb-2">
      <button type="button" onClick={() => setOpen(!open)} className="flex w-full cursor-pointer items-center justify-between px-1 py-1.5 text-[0.8rem] font-bold text-fg-faint">
        <span>
          {title} ({formatNumber(users.length)})
        </span>
        <ChevronDown className={cn('size-4 transition-transform', !open && 'rotate-90')} />
      </button>
      {open ? (
        <ul>
          {users.map((user) => {
            const color = playerColor(user, seasonal, eloHidden);
            const elo = seasonal ? user.eloSeason : user.eloOverall;
            return (
              <li key={user.userName} className="flex items-center justify-between gap-2 rounded-lg px-2 py-1.5 hover:bg-surface-2">
                <a href={`#/profile/${encodeURIComponent(user.userName)}`} className="min-w-0 truncate font-bold text-fg hover:underline" style={color ? { color } : undefined} dir="auto">
                  {user.userName}
                </a>
                <span className="flex shrink-0 items-center gap-2 text-[0.8rem] text-fg-faint">
                  {!eloHidden && elo && !user.staffDisableVisibleElo ? <span>{formatNumber(elo)}</span> : null}
                  <Status user={user} />
                </span>
              </li>
            );
          })}
        </ul>
      ) : null}
    </div>
  );
}

export default function OnlinePlayers({ className }: { className?: string }) {
  const userList = useClientState((state) => state.userList);
  const settings = useClientState((state) => state.userInfo.gameSettings);
  const seasonal = !settings?.disableSeasonal;
  const rating = (user: UserListItem) => (seasonal ? user.eloSeason : user.eloOverall) ?? 0;
  const byRating = (a: UserListItem, b: UserListItem) => rating(b) - rating(a) || a.userName.localeCompare(b.userName);

  const staff = userList.filter(isStaff).sort(byRating);
  const contributors = userList.filter((user) => !isStaff(user) && user.isContributor).sort(byRating);
  const rest = userList.filter((user) => !isStaff(user) && !user.isContributor);
  const experienced = rest.filter((user) => (seasonal ? user.isRainbowSeason : user.isRainbowOverall)).sort(byRating);
  const newcomers = rest.filter((user) => !(seasonal ? user.isRainbowSeason : user.isRainbowOverall)).sort((a, b) => a.userName.localeCompare(b.userName));

  return (
    <section className={cn('min-h-0 overflow-y-auto rounded-2xl bg-surface p-2', className)} aria-label="بازیکنان آنلاین">
      <div className="flex items-center justify-between px-1 pb-2 pt-1">
        <h2 className="font-display text-[1.3rem]">بازیکنان آنلاین</h2>
        <span className="flex items-center gap-1.5 text-[0.85rem] text-fg-muted">
          <span className="size-2 rounded-full bg-ok shadow-[0_0_6px_var(--color-ok)]" />
          {formatNumber(userList.length)}
        </span>
      </div>
      <Group title="کادر سایت" users={staff} seasonal={seasonal} eloHidden={settings?.disableElo} />
      <Group title="مشارکت‌کنندگان" users={contributors} seasonal={seasonal} eloHidden={settings?.disableElo} />
      <Group title="باتجربه‌ها" users={experienced} seasonal={seasonal} eloHidden={settings?.disableElo} />
      <Group title="تازه‌واردها" users={newcomers} seasonal={seasonal} eloHidden={settings?.disableElo} />
      {userList.length === 0 ? <p className="py-8 text-center text-fg-faint">کسی آنلاین نیست.</p> : null}
    </section>
  );
}
