import { Suspense } from 'react';
import SiteHeader, { SiteHeaderFallback } from './_components/site-header';

/**
 * Layout of the public site pages (legacy views/layout.pug): dark page,
 * fixed top menu, content column of at most 1127px.
 */
export default function SiteLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-site-bg">
      <Suspense fallback={<SiteHeaderFallback />}>
        <SiteHeader />
      </Suspense>
      <div className="mx-auto max-w-[1127px] pb-10">{children}</div>
    </div>
  );
}
