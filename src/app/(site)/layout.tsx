import { Suspense } from 'react';
import SiteHeader, { SiteHeaderFallback } from './_components/site-header';

/** Layout of the public site pages: the top bar, then the page. */
export default function SiteLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-dvh bg-ink text-fg">
      <Suspense fallback={<SiteHeaderFallback />}>
        <SiteHeader />
      </Suspense>
      <div className="mx-auto max-w-[1200px] pb-16">{children}</div>
    </div>
  );
}
