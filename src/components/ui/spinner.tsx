import { cn } from '@/lib/utils';

export function Spinner({ className }: { className?: string }) {
  return <span aria-hidden className={cn('inline-block size-8 animate-spin rounded-full border-[3px] border-line border-t-accent', className)} />;
}
