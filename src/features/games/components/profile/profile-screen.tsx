'use client';

import { Ban, Eye, Gamepad2, Sparkles, Trophy } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { formatNumber } from '@/lib/datetime';
import { playerColor } from '../common/player-color';
import { saveSettings } from '../common/save-settings';
import { useClientState } from '../store';

/**
 * A player's card: rating, experience and record from the online list. The
 * full statistics page (game history, badges, charts) comes with ranking.
 */

const STAFF: Record<string, string> = { admin: 'مدیر کل', editor: 'ویراستار', moderator: 'ناظر', trialmod: 'ناظر آزمایشی', altmod: 'ناظر', veteran: 'کهنه‌کار' };

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-2xl bg-surface-2 p-3 text-center">
      <p className="text-[0.8rem] text-fg-faint">{label}</p>
      <p className="mt-1 font-display text-[1.6rem] leading-none">{value}</p>
      {sub ? <p className="mt-1 text-[0.75rem] text-fg-faint">{sub}</p> : null}
    </div>
  );
}

export default function ProfileScreen() {
  const name = useClientState((state) => state.profileName ?? '');
  const user = useClientState((state) => state.userList.find((entry) => entry.userName === state.profileName));
  const myName = useClientState((state) => state.userInfo.userName);
  const settings = useClientState((state) => state.userInfo.gameSettings);
  const blacklist = settings?.blacklist ?? [];
  const seasonal = !settings?.disableSeasonal;
  const isMe = name === myName;
  const blacklisted = blacklist.some((entry) => entry.userName === name);
  const color = playerColor(user, seasonal, settings?.disableElo);

  const wins = (seasonal ? user?.winsSeason : user?.wins) ?? 0;
  const losses = (seasonal ? user?.lossesSeason : user?.losses) ?? 0;
  const games = wins + losses;
  const elo = seasonal ? user?.eloSeason : user?.eloOverall;
  const xp = seasonal ? user?.xpSeason : user?.xpOverall;

  return (
    <div className="mx-auto max-w-2xl px-4 pb-16 pt-6">
      <div className="flex items-center gap-4">
        <span className="flex size-20 shrink-0 items-center justify-center rounded-full bg-surface-3 font-display text-[2.6rem] text-fg ring-4 ring-surface-2" style={color ? { color } : undefined}>
          {name.slice(0, 1).toUpperCase()}
        </span>
        <div className="min-w-0">
          <h1 className="truncate font-display text-[2.1rem] leading-tight" style={color ? { color } : undefined} dir="auto">
            {name}
          </h1>
          <div className="mt-1 flex flex-wrap gap-1.5">
            {user?.staffRole && STAFF[user.staffRole] ? <Badge tone="fas">{STAFF[user.staffRole]}</Badge> : null}
            {user?.isContributor ? <Badge tone="lib">مشارکت‌کننده</Badge> : null}
            {(seasonal ? user?.isRainbowSeason : user?.isRainbowOverall) ? (
              <Badge tone="gold">
                <Sparkles className="size-3.5" /> باتجربه
              </Badge>
            ) : null}
            {user ? (
              <Badge tone="ok">آنلاین</Badge>
            ) : (
              <Badge>آفلاین</Badge>
            )}
            {user?.status?.gameId ? (
              <a href={`#/table/${user.status.gameId}`}>
                <Badge tone="accent">{user.status.type === 'observing' ? <Eye className="size-3.5" /> : <Gamepad2 className="size-3.5" />} {user.status.type === 'observing' ? 'در حال تماشا' : 'در حال بازی'}</Badge>
              </a>
            ) : null}
          </div>
        </div>
      </div>

      {user ? (
        <section className="mt-6">
          <p className="mb-2 text-[0.85rem] text-fg-faint">{seasonal ? 'آمار فصل جاری' : 'آمار همه‌ی زمان‌ها'}</p>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <Stat label="ELO" value={elo && !user.staffDisableVisibleElo && !settings?.disableElo ? formatNumber(Math.floor(elo)) : '—'} />
            <Stat label="امتیاز تجربه" value={xp && !user.staffDisableVisibleXP ? formatNumber(Math.floor(xp)) : '—'} />
            <Stat label="بازی" value={formatNumber(games)} sub={`${formatNumber(wins)} برد، ${formatNumber(losses)} باخت`} />
            <Stat label="نرخ برد" value={games ? `${formatNumber(Math.round((wins / games) * 100))}٪` : '—'} />
          </div>
        </section>
      ) : (
        <p className="mt-6 rounded-2xl bg-surface px-4 py-6 text-center text-fg-muted">این بازیکن الان آنلاین نیست. آمار کامل بازیکنان به‌زودی در این صفحه می‌آید.</p>
      )}

      <section className="mt-6 flex flex-wrap gap-2">
        {isMe ? (
          <a href="#/settings" className="text-accent-strong underline">
            ویرایش تنظیمات و درباره‌ی من
          </a>
        ) : myName ? (
          <Button
            variant={blacklisted ? 'secondary' : 'danger'}
            size="sm"
            onClick={() =>
              saveSettings({
                blacklist: blacklisted ? blacklist.filter((entry) => entry.userName !== name) : [...blacklist, { userName: name, reason: '', timestamp: Date.now() }].slice(-30),
              })
            }
          >
            <Ban className="size-4" /> {blacklisted ? 'برداشتن از فهرست سیاه' : 'افزودن به فهرست سیاه'}
          </Button>
        ) : null}
      </section>

      <p className="mt-8 flex items-center gap-2 text-[0.85rem] text-fg-faint">
        <Trophy className="size-4" /> تاریخچه‌ی بازی‌ها، نشان‌ها و نمودار ELO در به‌روزرسانی رتبه‌بندی اضافه می‌شود.
      </p>
    </div>
  );
}
