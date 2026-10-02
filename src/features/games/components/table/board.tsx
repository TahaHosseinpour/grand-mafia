'use client';

import { Ban, Bird, Crosshair, Crown, EyeOff, Layers, ScanEye, Search, Skull, Trophy, Vote } from 'lucide-react';
import { formatNumber } from '@/lib/datetime';
import { cn } from '@/lib/utils';
import type { GameInfo } from '../wire';
import { PolicyCard } from './cards';

/**
 * The two tracks, the election tracker and the piles. The fascist track
 * shows each slot's presidential power, where Hitler-as-chancellor starts to
 * win (the Hitler zone) and where the veto unlocks.
 */

export const POWERS: Record<string, { label: string; short: string; icon: typeof Search }> = {
  investigate: { label: 'رئیس‌جمهور عضویت حزبی یک بازیکن را می‌بیند.', short: 'تحقیق', icon: Search },
  deckpeek: { label: 'رئیس‌جمهور سه قانون بالای دسته را می‌بیند.', short: 'دیدن دسته', icon: Layers },
  election: { label: 'رئیس‌جمهور نامزد ریاست‌جمهوری بعدی را خودش انتخاب می‌کند.', short: 'انتخابات ویژه', icon: Vote },
  bullet: { label: 'رئیس‌جمهور باید یک بازیکن را اعدام کند.', short: 'اعدام', icon: Crosshair },
  reverseinv: { label: 'رئیس‌جمهور عضویت حزبی خودش را به یک بازیکن نشان می‌دهد.', short: 'نمایش عضویت', icon: ScanEye },
  peekdrop: { label: 'رئیس‌جمهور قانون بالای دسته را می‌بیند و می‌تواند دورش بیندازد.', short: 'دیدن و حذف', icon: EyeOff },
};

/** Standard powers by table size, for a table whose game has not started yet. */
function defaultPowers(players: number): (string | null)[] {
  if (players <= 6) return [null, null, 'deckpeek', 'bullet', 'bullet'];
  if (players <= 8) return [null, 'investigate', 'election', 'bullet', 'bullet'];
  return ['investigate', 'investigate', 'election', 'bullet', 'bullet'];
}

function Slot({ filled, tone, children, className }: { filled: boolean; tone: 'lib' | 'fas'; children?: React.ReactNode; className?: string }) {
  return (
    <div
      className={cn(
        'relative flex aspect-[5/7] items-center justify-center rounded-lg border-2 border-dashed',
        tone === 'lib' ? 'border-lib-soft/30 bg-lib-deep/40' : 'border-fas-soft/30 bg-fas-deep/40',
        className
      )}
    >
      {filled ? <PolicyCard policy={tone === 'lib' ? 'liberal' : 'fascist'} className="absolute inset-0 w-full shadow-[0_3px_0_rgb(0_0_0/0.35)]" /> : children}
    </div>
  );
}

export function LiberalTrack({ game }: { game: GameInfo }) {
  const count = game.trackState.liberalPolicyCount ?? 0;
  return (
    <section className="rounded-2xl bg-gradient-to-b from-[#24566a] to-lib-deep p-3 shadow-[inset_0_1px_0_rgb(255_255_255/0.08)]" aria-label={`${formatNumber(count)} قانون لیبرال از ۵`}>
      <header className="mb-2 flex items-center justify-between">
        <h3 className="flex items-center gap-1.5 font-display text-[1.35rem] leading-none text-lib-soft">
          <Bird className="size-5" aria-hidden /> لیبرال‌ها
        </h3>
        <span className="text-[0.8rem] font-bold text-lib-soft/80">{formatNumber(count)} از ۵</span>
      </header>
      <div className="grid grid-cols-5 gap-1.5">
        {Array.from({ length: 5 }, (_, i) => (
          <Slot key={i} filled={i < count} tone="lib">
            {i === 4 ? <Trophy className="size-5 text-lib-soft/50" aria-label="پیروزی لیبرال‌ها" /> : null}
          </Slot>
        ))}
      </div>
    </section>
  );
}

export function FascistTrack({ game }: { game: GameInfo }) {
  const count = game.trackState.fascistPolicyCount ?? 0;
  const settings = game.customGameSettings;
  const powers = settings.powers ?? defaultPowers(game.general.playerCount || game.publicPlayersState.length);
  const hitlerZone = settings.hitlerZone ?? 3;
  const vetoZone = settings.vetoZone ?? 5;

  return (
    <section className="rounded-2xl bg-gradient-to-b from-[#8a2a1c] to-fas-deep p-3 shadow-[inset_0_1px_0_rgb(255_255_255/0.08)]" aria-label={`${formatNumber(count)} قانون فاشیستی از ۶`}>
      <header className="mb-2 flex items-center justify-between">
        <h3 className="flex items-center gap-1.5 font-display text-[1.35rem] leading-none text-fas-soft">
          <Skull className="size-5" aria-hidden /> فاشیست‌ها
        </h3>
        <span className="text-[0.8rem] font-bold text-fas-soft/80">{formatNumber(count)} از ۶</span>
      </header>
      <div className="grid grid-cols-6 gap-1.5">
        {Array.from({ length: 6 }, (_, i) => {
          const power = i < 5 ? powers[i] : null;
          const info = power ? POWERS[power] : null;
          const inHitlerZone = i >= hitlerZone;
          return (
            <Slot key={i} filled={i < count} tone="fas" className={cn(inHitlerZone && 'border-solid border-fas-soft/40')}>
              <div className="flex flex-col items-center gap-0.5 px-0.5 text-center text-fas-soft/70" title={info?.label}>
                {i === 5 ? (
                  <Trophy className="size-5" aria-label="پیروزی فاشیست‌ها" />
                ) : info ? (
                  <>
                    <info.icon className="size-4" aria-hidden />
                    <span className="text-[0.55rem] font-bold leading-tight">{info.short}</span>
                  </>
                ) : null}
                {i + 1 === vetoZone ? <Ban className="absolute -top-1.5 end-0.5 size-4 rounded-full bg-fas-deep text-fas-soft" aria-label="وتو آزاد می‌شود" /> : null}
              </div>
            </Slot>
          );
        })}
      </div>
      <p className="mt-2 flex items-center gap-1.5 text-[0.75rem] text-fas-soft/75">
        <Crown className="size-3.5 shrink-0" aria-hidden />
        پس از {formatNumber(hitlerZone)} قانون فاشیستی، اگر هیتلر صدراعظم شود فاشیست‌ها می‌برند.
      </p>
    </section>
  );
}

export function ElectionTracker({ game }: { game: GameInfo }) {
  const failed = game.trackState.electionTrackerCount ?? 0;
  return (
    <div className="flex items-center gap-2" aria-label={`${formatNumber(failed)} انتخابات ناموفق از ۳`}>
      <span className="text-[0.75rem] font-bold text-fg-faint">رد شده</span>
      <div className="flex items-center gap-1">
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            className={cn('size-3.5 rounded-full border-2', i < failed ? 'border-gold bg-gold shadow-[0_0_8px_var(--color-gold)]' : 'border-fg-faint/60')}
          />
        ))}
      </div>
    </div>
  );
}

export function Piles({ game }: { game: GameInfo }) {
  return (
    <div className="flex items-center gap-3 text-[0.8rem] font-bold text-fg-muted">
      <span className="flex items-center gap-1.5" title="دسته‌ی قوانین">
        <span className="h-5 w-3.5 rounded-[3px] bg-paper/80 shadow-[2px_2px_0_rgb(0_0_0/0.4)]" />
        {formatNumber(game.gameState.undrawnPolicyCount ?? 0)}
      </span>
      <span className="flex items-center gap-1.5" title="قوانین دورریخته">
        <span className="h-5 w-3.5 rounded-[3px] bg-surface-3 ring-1 ring-fg-faint/60" />
        {formatNumber(game.gameState.discardedPolicyCount ?? 0)}
      </span>
    </div>
  );
}
