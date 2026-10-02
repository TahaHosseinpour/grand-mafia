'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Modal } from '@/components/ui/modal';
import type { GameInfo } from '../wire';
import { MembershipCard, PolicyCard, ROLE_INFO, RoleCard, type RoleKind } from './cards';
import { knownMemberships, mySeat, myRole, peekedPolicies, seatRoles, type Policy } from './derive';
import { seatName } from './seats';

/**
 * What the game shows only to this player: their secret role when the cards
 * are dealt, what a peek showed, and what an investigation revealed. Each is
 * shown once and stays until dismissed.
 */

const seenKey = (uid: string, what: string) => `seen:${uid}:${what}`;
const wasSeen = (key: string) => {
  try {
    return sessionStorage.getItem(key) === '1';
  } catch {
    return false;
  }
};
const markSeen = (key: string) => {
  try {
    sessionStorage.setItem(key, '1');
  } catch {
    // Private mode: the sheet may show again after a reload; harmless.
  }
};

const TEAM_TEXT: Record<'liberal' | 'fascist', { win: string; lose: string; tip: string }> = {
  liberal: {
    win: 'اگر پنج قانون لیبرال تصویب شود، یا هیتلر اعدام شود، برنده‌اید.',
    lose: 'اگر شش قانون فاشیستی تصویب شود، یا پس از سه قانون فاشیستی هیتلر صدراعظم شود، می‌بازید.',
    tip: 'چشم‌هایتان را باز نگه دارید و دنبال رفتارهای مشکوک بگردید. هیتلر را پیدا کنید و یادتان باشد هر کسی ممکن است دروغ بگوید!',
  },
  fascist: {
    win: 'اگر شش قانون فاشیستی تصویب شود، یا پس از سه قانون فاشیستی هیتلر صدراعظم شود، برنده‌اید.',
    lose: 'اگر پنج قانون لیبرال تصویب شود، یا هیتلر اعدام شود، می‌بازید.',
    tip: 'خودتان را لیبرال جا بزنید، به هم اعتماد بخرید و هیتلر را به صدارت برسانید.',
  },
};

function RoleReveal({ game, userName }: { game: GameInfo; userName: string }) {
  const role = myRole(game, userName) as RoleKind | null;
  const key = seenKey(game.general.uid, 'role');
  const [closedKey, setClosedKey] = useState<string | null>(null);
  const open = closedKey !== key && !wasSeen(key);

  if (!role || !(role in ROLE_INFO)) return null;
  const info = ROLE_INFO[role];
  const text = TEAM_TEXT[info.team];
  const me = mySeat(game, userName);
  const allies = seatRoles(game)
    .map((known, index) => ({ known, index }))
    .filter(({ known, index }) => index !== me && known && known !== 'merlin_candidate' && known !== 'liberal');

  const close = () => {
    markSeen(key);
    setClosedKey(key);
  };

  return (
    <Modal open={open} onClose={close} dismissible={false} size="default">
      <h2 className="font-display text-[2rem] leading-tight">
        شما: <span className={info.team === 'liberal' ? 'text-lib-soft' : 'text-fas-soft'}>{info.name}</span>
      </h2>
      <div className="mt-4 flex items-start gap-4">
        <RoleCard role={role} className="w-28 shrink-0 sm:w-36" />
        <div className="space-y-3 text-[1.05rem] font-bold leading-relaxed text-fg-muted">
          <p>{text.win}</p>
          <p>{text.lose}</p>
        </div>
      </div>
      {allies.length ? (
        <div className="mt-4 rounded-2xl bg-surface-2 p-3">
          <p className="mb-2 text-[0.85rem] text-fg-faint">چیزی که شما می‌دانید:</p>
          <ul className="flex flex-wrap gap-2">
            {allies.map(({ known, index }) => {
              const ally = ROLE_INFO[known as RoleKind];
              return (
                <li key={index} className="flex items-center gap-1.5 rounded-full bg-surface-3 py-1 pe-3 ps-1">
                  <span className={`rounded-full px-2 text-[0.75rem] font-bold leading-5 text-white ${ally?.tone ?? 'bg-fas'}`}>{ally?.name ?? known}</span>
                  <span className="font-bold" dir="auto">
                    {seatName(game, index, true, false)}
                  </span>
                </li>
              );
            })}
          </ul>
        </div>
      ) : null}
      <p className="mt-4 font-bold leading-relaxed text-accent-strong">{text.tip}</p>
      <Button variant="primary" size="lg" className="mx-auto mt-6 flex min-w-40" onClick={close}>
        باشه
      </Button>
    </Modal>
  );
}

function PeekResult({ game, userName }: { game: GameInfo; userName: string }) {
  const seen = peekedPolicies(game, userName);
  const key = seen ? seenKey(game.general.uid, `peek:${game.general.electionCount}`) : null;
  // The cards leave the table after a few seconds; keep what was seen until the player closes it.
  const [captured, setCaptured] = useState<{ key: string; cards: Policy[] } | null>(null);
  if (seen && key && captured?.key !== key && !wasSeen(key)) setCaptured({ key, cards: seen });

  if (!captured) return null;
  const shown = captured.cards;
  const close = () => {
    markSeen(captured.key);
    setCaptured(null);
  };
  return (
    <Modal open onClose={close} title={shown.length === 1 ? 'قانون بالای دسته' : 'سه قانون بالای دسته'} size="default">
      <p className="-mt-2 mb-5 text-fg-muted">{shown.length === 1 ? 'این قانون بالای دسته است.' : 'به ترتیب، از بالای دسته:'}</p>
      <div className="flex justify-center gap-3">
        {shown.map((policy, i) => (
          <PolicyCard key={i} policy={policy} className="w-24 sm:w-28" />
        ))}
      </div>
      <Button variant="primary" size="lg" fluid className="mt-6" onClick={close}>
        فهمیدم
      </Button>
    </Modal>
  );
}

function InvestigationResult({ game, userName }: { game: GameInfo; userName: string }) {
  const memberships = knownMemberships(game, userName);
  const latest = [...memberships.entries()].at(-1);
  const key = latest ? seenKey(game.general.uid, `membership:${latest[0]}`) : null;
  const [closedKey, setClosedKey] = useState<string | null>(null);

  if (!latest || !key || closedKey === key || wasSeen(key)) return null;
  const shown = { seat: latest[0], team: latest[1] };
  const close = () => {
    markSeen(key);
    setClosedKey(key);
  };
  const name = seatName(game, shown.seat, true, false);
  return (
    <Modal open onClose={close} title="عضویت حزبی" size="default">
      <p className="-mt-2 mb-5 text-fg-muted">
        <b className="text-fg">{name}</b> عضو حزب {shown.team === 'liberal' ? 'لیبرال' : 'فاشیست'} است.
      </p>
      <MembershipCard team={shown.team} className="mx-auto w-32" />
      <Button variant="primary" size="lg" fluid className="mt-6" onClick={close}>
        فهمیدم
      </Button>
    </Modal>
  );
}

export default function InfoSheets({ game, userName }: { game: GameInfo; userName: string | undefined }) {
  if (!userName || mySeat(game, userName) < 0) return null;
  return (
    <>
      <RoleReveal game={game} userName={userName} />
      <PeekResult game={game} userName={userName} />
      <InvestigationResult game={game} userName={userName} />
    </>
  );
}
