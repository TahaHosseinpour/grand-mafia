import { Bird, Crown, Moon, ScanEye, Shield, Skull, WandSparkles } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * The game's cards, drawn in CSS: paper on a dark table. Every card is a
 * size container, so its text and icon scale with whatever width it is given
 * (`className="w-24"`).
 */

type CardShellProps = {
  className?: string;
  selected?: boolean;
  dimmed?: boolean;
  onClick?: () => void;
  label?: string;
  children: React.ReactNode;
  tone?: 'paper' | 'dark';
};

function CardShell({ className, selected, dimmed, onClick, label, children, tone = 'paper' }: CardShellProps) {
  const Tag = onClick ? 'button' : 'div';
  return (
    <Tag
      type={onClick ? 'button' : undefined}
      onClick={onClick}
      aria-label={label}
      aria-pressed={onClick ? Boolean(selected) : undefined}
      className={cn(
        '@container relative aspect-[5/7] shrink-0 select-none overflow-hidden rounded-[10%/7%] p-[5%] shadow-[0_6px_0_rgb(0_0_0/0.35),0_10px_24px_rgb(0_0_0/0.35)] transition-[transform,opacity,box-shadow] duration-150',
        tone === 'paper' ? 'bg-paper text-paper-ink' : 'bg-[#2a2420] text-paper',
        onClick && 'cursor-pointer hover:-translate-y-1 active:translate-y-0',
        selected && '-translate-y-2 ring-4 ring-gold hover:-translate-y-2',
        dimmed && 'opacity-40 saturate-50',
        className
      )}
    >
      {children}
    </Tag>
  );
}

const POLICY = {
  liberal: { name: 'لیبرال', frame: 'border-lib', band: 'bg-lib', icon: Bird },
  fascist: { name: 'فاشیست', frame: 'border-fas', band: 'bg-fas', icon: Skull },
} as const;

export type PolicyKind = keyof typeof POLICY;

/** A policy card; `policy` undefined shows its back. */
export function PolicyCard({ policy, ...shell }: Omit<CardShellProps, 'children'> & { policy?: PolicyKind }) {
  if (!policy) {
    return (
      <CardShell {...shell} tone="dark" label={shell.label ?? 'قانون'}>
        <div className="flex h-full flex-col items-center justify-center rounded-[8%/6%] border-[2cqw] border-paper/25 bg-[repeating-linear-gradient(45deg,transparent_0_6px,rgb(255_255_255/0.04)_6px_12px)]">
          <span className="font-display text-[22cqw] leading-none text-paper/80">قانون</span>
        </div>
      </CardShell>
    );
  }
  const { name, frame, band, icon: Icon } = POLICY[policy];
  return (
    <CardShell {...shell} label={shell.label ?? `قانون ${name}`}>
      <div className={cn('flex h-full flex-col items-center justify-between rounded-[8%/6%] border-[3cqw] pb-[6cqw]', frame)}>
        <div className={cn('w-full py-[4cqw] text-center font-display text-[13cqw] leading-none text-white', band)}>قانون</div>
        <Icon className="size-[46cqw]" strokeWidth={1.75} aria-hidden />
        <div className="font-display text-[19cqw] leading-none">{name}</div>
      </div>
    </CardShell>
  );
}

/** A ballot: «آری!» or «نه!». */
export function BallotCard({ vote, ...shell }: Omit<CardShellProps, 'children'> & { vote: 'ja' | 'nein' }) {
  const yes = vote === 'ja';
  return (
    <CardShell {...shell} tone={yes ? 'paper' : 'dark'} label={shell.label ?? (yes ? 'رأی آری' : 'رأی نه')} className={cn('aspect-[7/5]', shell.className)}>
      <div className={cn('flex h-full flex-col items-center justify-center rounded-[6%/8%] border-[2.5cqw]', yes ? 'border-paper-ink' : 'border-paper/70')}>
        <span className="font-display text-[30cqw] leading-none">{yes ? 'آری!' : 'نه!'}</span>
        <span className="mt-[2cqw] text-[7cqw] font-bold opacity-70">{yes ? 'موافقم' : 'مخالفم'}</span>
      </div>
    </CardShell>
  );
}

export type RoleKind = 'liberal' | 'fascist' | 'hitler' | 'merlin' | 'percival' | 'morgana' | 'monarchist';

export const ROLE_INFO: Record<RoleKind, { name: string; team: 'liberal' | 'fascist'; icon: typeof Bird; tone: string }> = {
  liberal: { name: 'لیبرال', team: 'liberal', icon: Bird, tone: 'bg-lib' },
  fascist: { name: 'فاشیست', team: 'fascist', icon: Skull, tone: 'bg-fas' },
  hitler: { name: 'هیتلر', team: 'fascist', icon: Crown, tone: 'bg-hit' },
  merlin: { name: 'مرلین', team: 'liberal', icon: WandSparkles, tone: 'bg-[#355fc4]' },
  percival: { name: 'پرسیوال', team: 'liberal', icon: Shield, tone: 'bg-[#2f9fd6]' },
  morgana: { name: 'مورگانا', team: 'fascist', icon: Moon, tone: 'bg-[#d27a12]' },
  monarchist: { name: 'سلطنت‌طلب', team: 'fascist', icon: Crown, tone: 'bg-[#c4734f]' },
};

/** A secret role card. */
export function RoleCard({ role, ...shell }: Omit<CardShellProps, 'children'> & { role: RoleKind }) {
  const { name, icon: Icon, tone } = ROLE_INFO[role];
  return (
    <CardShell {...shell} label={shell.label ?? `نقش ${name}`}>
      <div className="flex h-full flex-col items-center rounded-[8%/6%] border-[2.5cqw] border-paper-ink/80 px-[4cqw] pt-[5cqw]">
        <span className="text-[8.5cqw] font-bold tracking-tight opacity-70">نقش مخفی شما</span>
        <span className="mt-[2cqw] font-display text-[20cqw] leading-none">{name}</span>
        <span className={cn('mt-auto mb-[8cqw] flex size-[52cqw] items-center justify-center rounded-full text-white shadow-inner', tone)}>
          <Icon className="size-[60%]" strokeWidth={1.75} aria-hidden />
        </span>
      </div>
    </CardShell>
  );
}

/** A party membership card (what an investigation shows). */
export function MembershipCard({ team, ...shell }: Omit<CardShellProps, 'children'> & { team: 'liberal' | 'fascist' }) {
  const liberal = team === 'liberal';
  return (
    <CardShell {...shell} label={shell.label ?? `عضو حزب ${liberal ? 'لیبرال' : 'فاشیست'}`}>
      <div className={cn('flex h-full flex-col items-center justify-center gap-[5cqw] rounded-[8%/6%] border-[3cqw]', liberal ? 'border-lib' : 'border-fas')}>
        <span className="text-[9cqw] font-bold opacity-70">عضویت حزبی</span>
        {liberal ? <Bird className="size-[44cqw] text-lib" aria-hidden /> : <Skull className="size-[44cqw] text-fas" aria-hidden />}
        <span className="font-display text-[18cqw] leading-none">{liberal ? 'لیبرال' : 'فاشیست'}</span>
      </div>
    </CardShell>
  );
}

/** The back of a membership card — an investigation is in progress. */
export function InvestigateIcon({ className }: { className?: string }) {
  return <ScanEye className={className} aria-hidden />;
}
