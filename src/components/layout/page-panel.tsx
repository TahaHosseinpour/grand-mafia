import { cn } from '@/lib/utils';

/**
 * The dark content panel of the site pages (legacy `.rules-container`,
 * `.howtoplay-container`, `.about-container`).
 */
export function PagePanel({ className, children }: { className?: string; children: React.ReactNode }) {
  return (
    <main className={cn('mt-[50px] bg-site-panel px-[1em] py-[10px] text-site-text', className)}>
      <div className="mx-auto max-w-[700px]">{children}</div>
    </main>
  );
}

/** Centered, underlined page title (`h1.ui.centered.header`). */
export function PageTitle({ children, underline = true }: { children: React.ReactNode; underline?: boolean }) {
  return (
    <h1 className={cn('mb-[10px] mt-[calc(2rem-0.14285714em)] text-center text-[2rem] font-bold leading-[1.28571429em] text-site-heading', underline && 'underline')}>
      {children}
    </h1>
  );
}

/** Centered section heading (`h2.ui.centered.header`). */
export function SectionTitle({ children, underline = true }: { children: React.ReactNode; underline?: boolean }) {
  return (
    <h2 className={cn('my-[20px] text-center text-[1.71428571rem] font-bold leading-[1.28571429em] text-site-heading', underline && 'underline')}>
      {children}
    </h2>
  );
}

/** Centered sub-heading (`h4.ui.centered.header`). */
export function SubTitle({ children }: { children: React.ReactNode }) {
  return <h4 className="mb-[10px] mt-[1.5em] text-center text-base font-bold text-site-heading underline">{children}</h4>;
}
