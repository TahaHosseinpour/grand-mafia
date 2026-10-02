'use client';

import { Fragment } from 'react';
import { cn } from '@/lib/utils';
import { useClientState } from '../store';
import type { ChatItem } from '../wire';

/**
 * Rendering chat: the game's own lines are lists of parts with a colour per
 * kind (a player, a team, a role); typed messages may contain `:emotes:`.
 */

const PART_COLORS: Record<string, string> = {
  player: 'font-bold text-fg',
  liberal: 'font-bold text-lib-soft',
  fascist: 'font-bold text-fas-soft',
  hitler: 'font-bold text-[#ff6a5a]',
  merlin: 'font-bold text-[#7f9cf5]',
  percival: 'font-bold text-[#67caff]',
  morgana: 'font-bold text-[#f69218]',
  monarchist: 'font-bold text-[#f29d78]',
};

/** «rrb» → three little policy chips. */
export function PolicyChips({ letters }: { letters: string }) {
  return (
    <span className="mx-0.5 inline-flex translate-y-[2px] gap-0.5 align-baseline" aria-label={[...letters].map((l) => (l === 'r' ? 'فاشیست' : 'لیبرال')).join('، ')}>
      {[...letters].map((letter, i) => (
        <span key={i} className={cn('inline-block h-4 w-3 rounded-[3px] ring-1 ring-black/30', letter === 'r' ? 'bg-fas' : 'bg-lib')} />
      ))}
    </span>
  );
}

/** Text with `:emote:` codes turned into images. */
export function EmoteText({ text }: { text: string }) {
  const emotes = useClientState((state) => state.allEmotes);
  const pieces = text.split(/(:[a-z0-9_]+:)/gi);
  return (
    <>
      {pieces.map((piece, i) =>
        emotes[piece] ? (
          // eslint-disable-next-line @next/next/no-img-element -- tiny inline emotes, not page images
          <img key={i} src={emotes[piece]} alt={piece} title={piece} className="mx-0.5 inline-block size-7 align-middle" />
        ) : (
          <Fragment key={i}>{piece}</Fragment>
        )
      )}
    </>
  );
}

type Part = { text?: string; type?: string; policies?: string[]; claim?: string };

/** A line the game wrote. */
export function GameLineParts({ parts }: { parts: Part[] }) {
  return (
    <>
      {parts.map((part, i) => {
        if (part.claim) return <PolicyChips key={i} letters={part.claim} />;
        if (part.policies) return <PolicyChips key={i} letters={part.policies.map((p) => (p === 'fascist' ? 'r' : 'b')).join('')} />;
        return (
          <span key={i} className={part.type ? PART_COLORS[part.type] : undefined}>
            {part.text}
          </span>
        );
      })}
    </>
  );
}

export const isGameLine = (entry: ChatItem): entry is Extract<ChatItem, { chat: unknown[] }> => Array.isArray((entry as { chat: unknown }).chat);
