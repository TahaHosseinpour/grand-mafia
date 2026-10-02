'use client';

import { Megaphone } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Modal } from '@/components/ui/modal';
import { cn } from '@/lib/utils';
import { emit } from '../socket';
import type { GameInfo } from '../wire';

/**
 * After a government (or a peek, or an investigation) the player may tell the
 * table what they saw with one tap — truthfully or not. The game records the
 * claim and announces it.
 */

const COMBOS: Record<string, { title: string; options: string[] }> = {
  wasPresident: { title: 'سه قانونی که رئیس‌جمهور دید', options: ['bbb', 'rbb', 'rrb', 'rrr'] },
  wasChancellor: { title: 'دو قانونی که صدراعظم گرفت', options: ['bb', 'rb', 'rr'] },
  didPolicyPeek: { title: 'سه قانون بالای دسته، به ترتیب', options: ['bbb', 'bbr', 'brb', 'rbb', 'brr', 'rbr', 'rrb', 'rrr'] },
  didSinglePolicyPeek: { title: 'قانون بالای دسته', options: ['liberal', 'fascist'] },
  didInvestigateLoyalty: { title: 'عضویت بازیکنی که دیدید', options: ['liberal', 'fascist'] },
};

function Option({ value }: { value: string }) {
  if (value === 'liberal' || value === 'fascist') {
    return <span className={cn('font-display text-[1.3rem]', value === 'liberal' ? 'text-lib-soft' : 'text-fas-soft')}>{value === 'liberal' ? 'لیبرال' : 'فاشیست'}</span>;
  }
  return (
    <span className="flex gap-1">
      {[...value].map((letter, i) => (
        <span key={i} className={cn('h-9 w-6 rounded-md ring-2 ring-black/30', letter === 'r' ? 'bg-fas' : 'bg-lib')} />
      ))}
    </span>
  );
}

export default function ClaimButton({ game, claim }: { game: GameInfo; claim: string }) {
  const [open, setOpen] = useState(false);
  const combo = COMBOS[claim];
  if (!combo) return null;

  return (
    <>
      <Button variant="secondary" size="sm" onClick={() => setOpen(true)} className="bg-gold/20 text-gold hover:bg-gold/30">
        <Megaphone className="size-4" /> ادعا
      </Button>
      <Modal open={open} onClose={() => setOpen(false)} title="ادعا کنید" size="default">
        <p className="-mt-2 mb-4 text-fg-muted">{combo.title} را به همه بگویید. هر چه انتخاب کنید در چت اعلام می‌شود.</p>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {combo.options.map((option) => (
            <button
              key={option}
              type="button"
              onClick={() => {
                emit('addNewClaim', { uid: game.general.uid, claim, claimState: option });
                setOpen(false);
              }}
              className="flex cursor-pointer items-center justify-center rounded-2xl bg-surface-2 py-4 ring-1 ring-line hover:bg-surface-3"
            >
              <Option value={option} />
            </button>
          ))}
        </div>
      </Modal>
    </>
  );
}
