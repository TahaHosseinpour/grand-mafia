import { cn } from '@/lib/utils';

/** A small label: a game's options, a player's status. */
const TONES = {
  neutral: 'bg-surface-3 text-fg-muted',
  accent: 'bg-accent/15 text-accent-strong',
  lib: 'bg-lib/20 text-lib-soft',
  fas: 'bg-fas/20 text-fas-soft',
  gold: 'bg-gold/15 text-gold',
  ok: 'bg-ok/15 text-[#8fd8a8]',
} as const;

export function Badge({
  tone = 'neutral',
  className,
  ...props
}: React.HTMLAttributes<HTMLSpanElement> & { tone?: keyof typeof TONES }) {
  return <span className={cn('inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2.5 py-0.5 text-[0.78rem] font-bold leading-5', TONES[tone], className)} {...props} />;
}
