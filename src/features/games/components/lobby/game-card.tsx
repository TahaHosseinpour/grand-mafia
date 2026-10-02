'use client';

import { Bird, Clock, EyeOff, Handshake, GraduationCap, Lock, MessageCircleOff, Rainbow, Settings2, Skull, Smile, Sparkles, Zap } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { formatNumber } from '@/lib/datetime';
import { cn } from '@/lib/utils';
import type { GameListItem } from '../wire';

/** One table in the lobby list: its state, options, seats and Elo/XP limits. */

function Options({ game }: { game: GameListItem }) {
  const items: { key: string; tone?: 'neutral' | 'accent' | 'gold' | 'lib' | 'fas'; icon?: typeof Clock; label: string }[] = [];

  if (game.isCustomGame) items.push({ key: 'custom', tone: 'accent', icon: Settings2, label: 'سفارشی' });
  else if (game.practiceGame) items.push({ key: 'practice', tone: 'lib', icon: GraduationCap, label: 'تمرینی' });
  else if (game.casualGame) items.push({ key: 'casual', icon: Handshake, label: 'غیررسمی' });
  else items.push({ key: 'ranked', tone: 'gold', icon: Sparkles, label: 'رتبه‌ای' });

  if (game.rainbowgame) items.push({ key: 'rainbow', icon: Rainbow, label: 'باتجربه‌ها' });
  if (game.timedMode) items.push({ key: 'timed', icon: Clock, label: `${formatNumber(Number(game.timedMode))} ثانیه` });
  if (game.experiencedMode) items.push({ key: 'fast', icon: Zap, label: 'سریع' });
  if (game.blindMode) items.push({ key: 'blind', icon: EyeOff, label: 'ناشناس' });
  if (game.playerChats === 'disabled') items.push({ key: 'silent', icon: MessageCircleOff, label: 'بی‌صدا' });
  if (game.playerChats === 'emotes') items.push({ key: 'emotes', icon: Smile, label: 'فقط ایموجی' });
  if (game.avalonSH) items.push({ key: 'avalon', label: 'آوالون' });
  if (game.monarchistSH) items.push({ key: 'monarchist', label: 'سلطنت‌طلب' });
  if (game.rebalance6p || game.rebalance7p || game.rebalance9p2f) items.push({ key: 'rebalance', label: 'متعادل‌شده' });
  if (game.noTopdecking) items.push({ key: 'topdeck', label: 'بدون تاپ‌دک' });
  if (game.isVerifiedOnly) items.push({ key: 'verified', label: 'فقط تأییدشده' });
  if (game.eloMinimum) items.push({ key: 'elo', label: `ELO ≥ ${formatNumber(Number(game.eloMinimum))}` });
  if (game.xpMinimum) items.push({ key: 'xp', label: `XP ≥ ${formatNumber(Number(game.xpMinimum))}` });

  return (
    <div className="flex flex-wrap gap-1.5">
      {items.map(({ key, tone, icon: Icon, label }) => (
        <Badge key={key} tone={tone}>
          {Icon ? <Icon className="size-3.5" aria-hidden /> : null}
          {label}
        </Badge>
      ))}
    </div>
  );
}

function Seats({ game }: { game: GameListItem }) {
  const max = game.maxPlayersCount;
  const min = game.minPlayersCount;
  const excluded = new Set(game.excludedPlayerCount ?? []);
  return (
    <div className="flex items-center gap-1" aria-label={`${formatNumber(game.seatedCount)} از ${formatNumber(max)} صندلی`}>
      {Array.from({ length: max }, (_, i) => {
        const taken = i < game.seatedCount;
        const allowedCount = i + 1 >= min && !excluded.has(i + 1);
        return (
          <span
            key={i}
            className={cn(
              'h-2.5 w-2.5 rounded-full',
              taken ? 'bg-accent shadow-[0_0_6px_rgb(225_90_43/0.6)]' : allowedCount ? 'bg-surface-3 ring-1 ring-fg-faint/60' : 'bg-surface-3/60'
            )}
          />
        );
      })}
    </div>
  );
}

function Progress({ game }: { game: GameListItem }) {
  const lib = game.enactedLiberalPolicyCount ?? 0;
  const fas = game.enactedFascistPolicyCount ?? 0;
  return (
    <div className="flex items-center gap-3 text-[0.85rem] font-bold">
      <span className="flex items-center gap-1 text-lib-soft">
        <Bird className="size-4" aria-hidden />
        {formatNumber(lib)}/۵
      </span>
      <span className="flex items-center gap-1 text-fas-soft">
        <Skull className="size-4" aria-hidden />
        {formatNumber(fas)}/۶
      </span>
    </div>
  );
}

export default function GameCard({ game, mine }: { game: GameListItem; mine: boolean }) {
  const status = game.gameStatus;
  const finished = status === 'liberal' || status === 'fascist';
  const running = status === 'isStarted';
  const seatsLeft = game.maxPlayersCount - game.seatedCount;
  const needed = Math.max(0, game.minPlayersCount - game.seatedCount);

  const statusLine = finished
    ? status === 'liberal'
      ? 'لیبرال‌ها بردند'
      : 'فاشیست‌ها بردند'
    : running
      ? `در جریان، انتخابات ${formatNumber(game.electionCount ?? 0)}`
      : needed > 0
        ? `منتظر ${formatNumber(needed)} بازیکن دیگر`
        : seatsLeft > 0
          ? 'آماده‌ی شروع'
          : 'در حال شروع';

  return (
    <a
      href={`#/table/${game.uid}`}
      className={cn(
        'group relative block overflow-hidden rounded-2xl border border-line bg-surface p-4 text-fg transition-colors hover:border-fg-faint hover:bg-surface-2 hover:text-fg',
        mine && 'border-accent/70'
      )}
    >
      <span
        aria-hidden
        className={cn(
          'absolute inset-y-0 start-0 w-1.5',
          finished ? (status === 'liberal' ? 'bg-lib' : 'bg-fas') : running ? 'bg-lib-soft/70' : 'bg-gold'
        )}
      />
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="flex items-center gap-1.5 truncate font-display text-[1.35rem] leading-tight">
            {game.private ? <Lock className="size-4 shrink-0 text-gold" aria-label="خصوصی" /> : null}
            <span className="truncate" dir="auto">
              {game.name}
            </span>
          </h3>
          <p className={cn('mt-0.5 text-[0.85rem]', finished ? (status === 'liberal' ? 'text-lib-soft' : 'text-fas-soft') : 'text-fg-muted')}>{statusLine}</p>
        </div>
        <div className="shrink-0 text-end">
          <div className="font-display text-[1.6rem] leading-none">
            {formatNumber(game.seatedCount)}
            <span className="text-[1rem] text-fg-faint">/{formatNumber(game.maxPlayersCount)}</span>
          </div>
          {game.minPlayersCount !== game.maxPlayersCount ? (
            <div className="text-[0.75rem] text-fg-faint">
              {formatNumber(game.minPlayersCount)} تا {formatNumber(game.maxPlayersCount)} نفر
            </div>
          ) : null}
        </div>
      </div>

      <div className="mt-3">
        <Options game={game} />
      </div>

      <div className="mt-3 flex items-center justify-between gap-3">
        {running || finished ? <Progress game={game} /> : <Seats game={game} />}
        <span className="text-[0.85rem] font-bold text-accent-strong group-hover:underline">
          {mine ? 'بازگشت به میز' : !running && !finished && seatsLeft > 0 ? 'ورود به میز' : 'تماشا'}
        </span>
      </div>
    </a>
  );
}
