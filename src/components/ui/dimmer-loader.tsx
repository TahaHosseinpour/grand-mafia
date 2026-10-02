import { Spinner } from './spinner';

/** A dim layer with a spinner over a form while it submits. */
export function DimmerLoader({ active, text }: { active: boolean; text: string }) {
  if (!active) return null;
  return (
    <div role="status" aria-live="polite" className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 rounded-xl bg-surface/85">
      <Spinner />
      <span className="text-fg-muted">{text}</span>
    </div>
  );
}
