'use client';

import { Minus, Plus } from 'lucide-react';
import { cn } from '@/lib/utils';

/** A number picked with − and + (player counts, deck sizes). */
export function Stepper({
  value,
  onChange,
  min,
  max,
  label,
  className,
}: {
  value: number;
  onChange: (value: number) => void;
  min: number;
  max: number;
  label: React.ReactNode;
  className?: string;
}) {
  const button = 'flex size-10 cursor-pointer items-center justify-center rounded-xl bg-surface-3 text-fg hover:bg-[#3a3531] disabled:cursor-not-allowed disabled:opacity-30';
  return (
    <div className={cn('flex items-center justify-between gap-3 py-1.5', className)}>
      <span className="text-fg">{label}</span>
      <span className="flex items-center gap-2">
        <button type="button" className={button} disabled={value >= max} onClick={() => onChange(Math.min(max, value + 1))} aria-label="بیشتر">
          <Plus className="size-4" />
        </button>
        <span className="w-8 text-center font-display text-[1.4rem] leading-none">{value.toLocaleString('fa-IR')}</span>
        <button type="button" className={button} disabled={value <= min} onClick={() => onChange(Math.max(min, value - 1))} aria-label="کمتر">
          <Minus className="size-4" />
        </button>
      </span>
    </div>
  );
}
