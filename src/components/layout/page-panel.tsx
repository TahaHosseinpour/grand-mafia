import { cn } from '@/lib/utils';

/** The content column of the site's text pages (rules, terms, about…). */
export function PagePanel({ className, children }: { className?: string; children: React.ReactNode }) {
  return (
    <main className={cn('px-4 pt-6 text-fg-muted', className)}>
      <div className="mx-auto max-w-3xl rounded-3xl bg-surface px-5 py-6 sm:px-8 sm:py-8">{children}</div>
    </main>
  );
}

export function PageTitle({ children }: { children: React.ReactNode; underline?: boolean }) {
  return <h1 className="mb-5 text-center font-display text-[2.2rem] leading-tight text-fg sm:text-[2.6rem]">{children}</h1>;
}

export function SectionTitle({ children }: { children: React.ReactNode; underline?: boolean }) {
  return (
    <h2 className="mb-3 mt-8 flex items-center gap-2 font-display text-[1.6rem] leading-tight text-fg">
      <span aria-hidden className="h-6 w-1.5 rounded-full bg-accent" />
      {children}
    </h2>
  );
}

export function SubTitle({ children }: { children: React.ReactNode }) {
  return <h4 className="mb-2 mt-6 text-[1.1rem] font-bold text-fg">{children}</h4>;
}
