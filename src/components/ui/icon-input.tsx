import { forwardRef } from 'react';
import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * Semantic UI "left icon input": a text field with an icon at its start
 * edge (the right edge in RTL). `dir="auto"` lets Latin text (usernames,
 * emails) read left-to-right once typed, while the Persian placeholder
 * stays right-aligned.
 */
export type IconInputProps = React.InputHTMLAttributes<HTMLInputElement> & {
  icon?: LucideIcon;
  invalid?: boolean;
};

export const IconInput = forwardRef<HTMLInputElement, IconInputProps>(function IconInput(
  { icon: Icon, invalid, className, ...props },
  ref
) {
  return (
    <div className="relative flex w-full text-ui-text">
      {Icon ? (
        <Icon
          aria-hidden
          className="pointer-events-none absolute start-[0.9em] top-1/2 size-[1em] -translate-y-1/2 opacity-50"
          strokeWidth={2.5}
        />
      ) : null}
      <input
        ref={ref}
        dir="auto"
        className={cn(
          'w-full rounded-ui border border-ui-border bg-white px-[1em] py-[0.67857143em] leading-[1.21428571em] text-ui-text outline-none transition-[border-color,box-shadow] duration-100',
          'placeholder:text-ui-placeholder focus:border-[#85b7d9]',
          Icon && 'ps-[2.67142857em]',
          invalid && 'border-ui-negative-border bg-ui-negative-bg text-ui-negative-text',
          className
        )}
        aria-invalid={invalid || undefined}
        {...props}
      />
    </div>
  );
});
