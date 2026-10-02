import { forwardRef } from 'react';
import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * A text field, optionally with an icon at its start edge (the right edge in
 * RTL). `dir="auto"` lets Latin text (usernames, emails) read left-to-right
 * once typed, while the Persian placeholder stays right-aligned.
 */
export type IconInputProps = React.InputHTMLAttributes<HTMLInputElement> & {
  icon?: LucideIcon;
  invalid?: boolean;
};

export const fieldClasses =
  'w-full rounded-xl border border-line bg-surface-2 px-4 text-fg outline-none transition-[border-color,box-shadow] duration-100 placeholder:text-fg-faint focus:border-accent focus:shadow-[0_0_0_3px_rgb(225_90_43/0.25)]';

export const IconInput = forwardRef<HTMLInputElement, IconInputProps>(function IconInput(
  { icon: Icon, invalid, className, ...props },
  ref
) {
  return (
    <div className="relative flex w-full">
      {Icon ? (
        <Icon aria-hidden className="pointer-events-none absolute start-4 top-1/2 size-[1.1em] -translate-y-1/2 text-fg-faint" strokeWidth={2.25} />
      ) : null}
      <input
        ref={ref}
        dir="auto"
        className={cn(fieldClasses, 'h-12', Icon && 'ps-11', invalid && 'border-danger bg-danger/10', className)}
        aria-invalid={invalid || undefined}
        {...props}
      />
    </div>
  );
});
