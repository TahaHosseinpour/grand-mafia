import type { Metadata } from 'next';
import { PagePanel, PageTitle } from '@/components/layout/page-panel';

export const metadata: Metadata = { title: 'آمار — هیتلر مخفی' };

/**
 * Win-rate statistics (legacy views/page-stats.pug). The charts are built
 * from finished games and arrive with the ranking phase (docs/migration.md).
 */
export default function StatsPage() {
  return (
    <PagePanel>
      <PageTitle>آمار</PageTitle>
      <p className="pb-[1em] text-center text-base">نمودارهای درصد برد پس از ثبت نخستین بازی‌ها در اینجا نمایش داده می‌شوند.</p>
    </PagePanel>
  );
}
