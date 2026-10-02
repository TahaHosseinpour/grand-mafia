import { cn } from '@/lib/utils';

/** A notice: info (blue), negative (red), positive (green). */
const VARIANTS = {
  info: 'border-lib bg-lib/12 text-lib-soft',
  negative: 'border-danger bg-danger/12 text-[#f6a3a3]',
  positive: 'border-ok bg-ok/12 text-[#a8e2bb]',
} as const;

export function Message({
  variant = 'info',
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement> & { variant?: keyof typeof VARIANTS }) {
  return (
    <div
      role={variant === 'negative' ? 'alert' : 'status'}
      className={cn('my-4 rounded-xl border-s-4 px-4 py-3 leading-relaxed', VARIANTS[variant], className)}
      {...props}
    />
  );
}
