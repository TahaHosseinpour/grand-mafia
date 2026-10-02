import { cn } from '@/lib/utils';

/** Semantic UI "inverted dimmer + text loader" laid over a submitting form. */
export function DimmerLoader({ active, text }: { active: boolean; text: string }) {
  if (!active) return null;
  return (
    <div
      role="status"
      aria-live="polite"
      className={cn('absolute inset-0 z-10 flex flex-col items-center justify-center gap-[0.5em] rounded-ui bg-white/85')}
    >
      <span className="size-[2.28571429rem] animate-spin rounded-full border-[0.2em] border-black/10 border-t-[#767676]" />
      <span className="text-ui-text-muted">{text}</span>
    </div>
  );
}
