'use client';

import { Crown, Skull, Unplug, UserPlus, UserRoundX } from 'lucide-react';
import { formatNumber } from '@/lib/datetime';
import { cn } from '@/lib/utils';
import { playerColor } from '../common/player-color';
import { useClientState } from '../store';
import type { GameInfo } from '../wire';
import { ROLE_INFO, type RoleKind } from './cards';
import { knownMemberships, mySeat, revealedVotes, seatRoles } from './derive';

/**
 * The players around the table: seat number, name, government badges, what
 * the viewer knows of their role, their vote once revealed, and who the game
 * is waiting on. During a choice (nominate, investigate, execute…) the
 * selectable seats light up and are tappable.
 */

const GOVERNMENT: Record<string, { label: string; className: string }> = {
  isPresident: { label: 'رئیس‌جمهور', className: 'bg-gold text-paper-ink' },
  isChancellor: { label: 'صدراعظم', className: 'bg-lib-soft text-paper-ink' },
  isPendingPresident: { label: 'نامزد ریاست', className: 'bg-gold/25 text-gold ring-1 ring-gold/60' },
  isPendingChancellor: { label: 'نامزد صدارت', className: 'bg-lib-soft/20 text-lib-soft ring-1 ring-lib-soft/60' },
};

export function seatName(game: GameInfo, index: number, viewerSeated: boolean, viewerIsStaff: boolean): string {
  const player = game.publicPlayersState[index];
  if (game.general.blindMode && !game.gameState.isCompleted) {
    return game.gameState.isTracksFlipped && game.general.replacementNames ? game.general.replacementNames[index] : '?';
  }
  if (!viewerSeated && !viewerIsStaff) {
    if (player.isPrivate) return 'ناشناس';
    if (game.general.private) return '?';
  }
  return player.userName;
}

export default function Seats({
  game,
  selectable,
  selected,
  onSelect,
  emptySeats = 0,
}: {
  game: GameInfo;
  selectable?: number[];
  selected?: number | null;
  onSelect?: (index: number) => void;
  /** Free seats drawn after the players (before the game starts). */
  emptySeats?: number;
}) {
  const userName = useClientState((state) => state.userInfo.userName);
  const staffRole = useClientState((state) => state.userInfo.staffRole);
  const userList = useClientState((state) => state.userList);
  const settings = useClientState((state) => state.userInfo.gameSettings);
  const me = mySeat(game, userName);
  const roles = seatRoles(game);
  const votes = revealedVotes(game);
  const memberships = knownMemberships(game, userName);
  const isStaff = Boolean(staffRole && staffRole !== 'veteran' && staffRole !== 'altmod');
  const blind = game.general.blindMode && !game.gameState.isCompleted;
  const started = Boolean(game.gameState.isTracksFlipped);

  return (
    <ul className="grid grid-cols-[repeat(auto-fill,minmax(4.4rem,1fr))] gap-2" aria-label="بازیکنان">
      {game.publicPlayersState.map((player, index) => {
        const name = seatName(game, index, me >= 0, isStaff);
        const user = blind ? undefined : userList.find((entry) => entry.userName === player.userName);
        const color = playerColor(user, !settings?.disableSeasonal, settings?.disableElo);
        const role = roles[index];
        const roleInfo = role && role in ROLE_INFO ? ROLE_INFO[role as RoleKind] : null;
        const vote = votes[index];
        const membership = memberships.get(index);
        const canPick = Boolean(selectable?.includes(index));
        const isSelected = selected === index;
        const government = player.governmentStatus ? GOVERNMENT[player.governmentStatus] : null;
        const Tag = canPick ? 'button' : 'div';

        return (
          <li key={`${player.userName}-${index}`}>
            <Tag
              type={canPick ? 'button' : undefined}
              onClick={canPick ? () => onSelect?.(index) : undefined}
              className={cn(
                'relative flex w-full flex-col items-center rounded-2xl bg-surface px-1 pb-2 pt-3 text-center transition',
                index === me && 'bg-surface-2 ring-1 ring-accent/50',
                canPick && 'cursor-pointer ring-2 ring-gold/70 hover:bg-surface-3',
                isSelected && 'bg-gold/15 ring-4 ring-gold',
                selectable && !canPick && 'opacity-40',
                player.isDead && 'opacity-60'
              )}
            >
              {started ? (
                <span className="absolute start-1.5 top-1.5 text-[0.7rem] font-bold text-fg-faint">{formatNumber(index + 1)}</span>
              ) : null}

              <span
                className={cn(
                  'relative flex size-12 items-center justify-center rounded-full font-display text-[1.5rem] leading-none',
                  roleInfo ? `${roleInfo.tone} text-white` : 'bg-surface-3 text-fg-muted',
                  player.isLoader && 'animate-pulse ring-2 ring-accent',
                  player.isDead && 'grayscale'
                )}
              >
                {player.isDead ? <Skull className="size-6 text-paper" aria-label="مرده" /> : name.slice(0, 1).toUpperCase()}
                {player.governmentStatus === 'isPresident' || player.governmentStatus === 'isPendingPresident' ? (
                  <Crown className="absolute -top-2 size-4 text-gold" aria-hidden />
                ) : null}
                {vote !== null ? (
                  <span
                    className={cn(
                      'absolute -bottom-2 rounded-md px-1.5 font-display text-[0.8rem] leading-5 shadow',
                      vote ? 'bg-paper text-paper-ink' : 'bg-[#2a2420] text-paper ring-1 ring-paper/50'
                    )}
                  >
                    {vote ? 'آری' : 'نه'}
                  </span>
                ) : null}
              </span>

              <span className="mt-2 w-full truncate text-[0.78rem] font-bold leading-tight" style={color ? { color } : undefined} dir="auto">
                {name}
              </span>

              <span className="mt-1 flex min-h-5 flex-wrap justify-center gap-0.5">
                {government ? <span className={cn('rounded-full px-1.5 text-[0.62rem] font-bold leading-4', government.className)}>{government.label}</span> : null}
                {!government && player.previousGovernmentStatus ? (
                  <span className="rounded-full px-1.5 text-[0.62rem] leading-4 text-fg-faint ring-1 ring-line">
                    {player.previousGovernmentStatus === 'wasPresident' ? 'رئیس قبلی' : 'صدراعظم قبلی'}
                  </span>
                ) : null}
                {roleInfo && index !== me ? (
                  <span className={cn('rounded-full px-1.5 text-[0.62rem] font-bold leading-4 text-white', roleInfo.tone)}>{roleInfo.name}</span>
                ) : null}
                {role === 'merlin_candidate' ? <span className="rounded-full bg-[#355fc4]/40 px-1.5 text-[0.62rem] leading-4 text-[#b9c8ff]">مرلین؟</span> : null}
                {membership ? (
                  <span className={cn('rounded-full px-1.5 text-[0.62rem] font-bold leading-4', membership === 'liberal' ? 'bg-lib/30 text-lib-soft' : 'bg-fas/30 text-fas-soft')}>
                    {membership === 'liberal' ? 'عضو لیبرال' : 'عضو فاشیست'}
                  </span>
                ) : null}
                {index === me ? <span className="text-[0.62rem] font-bold leading-4 text-accent-strong">شما</span> : null}
              </span>

              {player.leftGame ? (
                <UserRoundX className="absolute end-1.5 top-1.5 size-3.5 text-fg-faint" aria-label="بازی را ترک کرد" />
              ) : !player.connected ? (
                <Unplug className="absolute end-1.5 top-1.5 size-3.5 text-fg-faint" aria-label="قطع شده" />
              ) : null}
            </Tag>
          </li>
        );
      })}
      {Array.from({ length: emptySeats }, (_, i) => (
        <li key={`empty-${i}`} aria-hidden className="flex min-h-[7.25rem] items-center justify-center rounded-2xl border-2 border-dashed border-line text-fg-faint">
          <UserPlus className="size-5" />
        </li>
      ))}
    </ul>
  );
}
