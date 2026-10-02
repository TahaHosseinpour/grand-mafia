'use client';

import { Smile } from 'lucide-react';
import { useState } from 'react';
import { Modal } from '@/components/ui/modal';
import { useClientState } from '../store';

/** The emote button next to a chat box: a grid of every `:emote:`. */
export default function EmotePicker({ onPick }: { onPick: (code: string) => void }) {
  const [open, setOpen] = useState(false);
  const emotes = useClientState((state) => state.allEmotes);
  const codes = Object.keys(emotes).sort();
  if (!codes.length) return null;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="ایموجی‌ها"
        className="flex size-11 shrink-0 cursor-pointer items-center justify-center rounded-xl text-fg-muted hover:bg-surface-3 hover:text-fg"
      >
        <Smile className="size-6" />
      </button>
      <Modal open={open} onClose={() => setOpen(false)} title="ایموجی‌ها" size="default">
        <div className="grid max-h-[50dvh] grid-cols-[repeat(auto-fill,minmax(44px,1fr))] gap-1 overflow-y-auto">
          {codes.map((code) => (
            <button
              key={code}
              type="button"
              title={code}
              onClick={() => {
                onPick(code);
                setOpen(false);
              }}
              className="flex aspect-square cursor-pointer items-center justify-center rounded-lg hover:bg-surface-3"
            >
              {/* eslint-disable-next-line @next/next/no-img-element -- tiny emote images */}
              <img src={emotes[code]} alt={code} className="size-8" loading="lazy" />
            </button>
          ))}
        </div>
      </Modal>
    </>
  );
}
