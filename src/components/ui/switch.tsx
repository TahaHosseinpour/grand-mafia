'use client';

import { useId } from 'react';
import { cn } from '@/lib/utils';

/** An on/off switch with its label (and an optional hint under it). */
export function Switch({
  checked,
  onChange,
  label,
  hint,
  disabled,
  className,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: React.ReactNode;
  hint?: React.ReactNode;
  disabled?: boolean;
  className?: string;
}) {
  const id = useId();
  return (
    <label htmlFor={id} className={cn('flex cursor-pointer items-center justify-between gap-4 py-2.5', disabled && 'cursor-not-allowed opacity-50', className)}>
      <span className="min-w-0">
        <span className="block text-fg">{label}</span>
        {hint ? <span className="mt-0.5 block text-[0.85rem] leading-snug text-fg-faint">{hint}</span> : null}
      </span>
      <span className="relative inline-flex shrink-0">
        <input id={id} type="checkbox" role="switch" className="peer sr-only" checked={checked} disabled={disabled} onChange={(event) => onChange(event.target.checked)} />
        <span className="h-7 w-12 rounded-full bg-surface-3 ring-1 ring-line transition-colors peer-checked:bg-accent peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-accent" />
        <span className="absolute start-1 top-1 size-5 rounded-full bg-fg shadow transition-transform peer-checked:-translate-x-5" />
      </span>
    </label>
  );
}
