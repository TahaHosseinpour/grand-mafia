'use client';

import { cn } from '@/lib/utils';

/** One choice out of a few, as a row of pills. */
export function Segmented<T extends string | number>({
  value,
  onChange,
  options,
  className,
  ariaLabel,
}: {
  value: T;
  onChange: (value: T) => void;
  options: { value: T; label: React.ReactNode; disabled?: boolean }[];
  className?: string;
  ariaLabel?: string;
}) {
  return (
    <div role="radiogroup" aria-label={ariaLabel} className={cn('flex gap-1 rounded-2xl bg-surface-2 p-1', className)}>
      {options.map((option) => (
        <button
          key={String(option.value)}
          type="button"
          role="radio"
          aria-checked={option.value === value}
          disabled={option.disabled}
          onClick={() => onChange(option.value)}
          className={cn(
            'flex-1 cursor-pointer rounded-xl px-2 py-2 text-[0.9rem] font-bold transition-colors disabled:cursor-not-allowed disabled:opacity-40',
            option.value === value ? 'bg-accent text-white shadow-[0_2px_0_var(--color-accent-deep)]' : 'text-fg-muted hover:bg-surface-3 hover:text-fg'
          )}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
