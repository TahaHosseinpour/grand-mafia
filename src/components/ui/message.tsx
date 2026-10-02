import { cn } from '@/lib/utils';

/** Semantic UI message box: info (blue), negative (red), positive (green). */
const VARIANTS = {
  info: 'bg-ui-info-bg text-ui-info-text shadow-[inset_0_0_0_1px_var(--color-ui-info-border)]',
  negative: 'bg-ui-negative-bg text-ui-negative-text shadow-[inset_0_0_0_1px_var(--color-ui-negative-border)]',
  positive: 'bg-ui-positive-bg text-ui-positive-text shadow-[inset_0_0_0_1px_var(--color-ui-positive-border)]',
} as const;

export function Message({
  variant = 'info',
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement> & { variant?: keyof typeof VARIANTS }) {
  return (
    <div
      role={variant === 'negative' ? 'alert' : 'status'}
      className={cn('my-[1em] rounded-ui px-[1.5em] py-[1em] leading-[1.4285em]', VARIANTS[variant], className)}
      {...props}
    />
  );
}
