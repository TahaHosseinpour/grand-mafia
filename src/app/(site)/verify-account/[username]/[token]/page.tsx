import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { Suspense } from 'react';
import { PagePanel, SectionTitle } from '@/components/layout/page-panel';
import { getSession } from '@/server/auth';
import { verifyEmail, verifyEmailInput } from '@/features/auth';

export const metadata: Metadata = { title: 'تأیید حساب — هیتلر مخفی', robots: { index: false } };

/**
 * The page a verification email links to. Like the legacy route it needs
 * the account to be signed in; on success it goes to the account page.
 */
export default function VerifyAccountPage({ params }: PageProps<'/verify-account/[username]/[token]'>) {
  return (
    <PagePanel className="text-site-heading">
      <Suspense fallback={<p className="text-center">در حال تأیید…</p>}>
        <Verify params={params} />
      </Suspense>
    </PagePanel>
  );
}

async function Verify({ params }: { params: PageProps<'/verify-account/[username]/[token]'>['params'] }) {
  const raw = await params;
  if (!(await getSession())) {
    return (
      <>
        <SectionTitle underline={false}>تأیید حساب</SectionTitle>
        <p className="pb-[1em] text-center">برای تأیید حساب، ابتدا وارد حساب خود شوید و دوباره روی لینک ایمیل بزنید.</p>
      </>
    );
  }
  const parsed = verifyEmailInput.safeParse({ username: decodeURIComponent(raw.username), token: raw.token });
  const ok = parsed.success && (await verifyEmail(parsed.data));
  if (ok) redirect('/account');
  return (
    <>
      <SectionTitle underline={false}>تأیید حساب</SectionTitle>
      <p className="pb-[1em] text-center">این لینک نامعتبر است یا منقضی شده. از صفحه‌ی حساب کاربری، ایمیل تأیید جدیدی درخواست کنید.</p>
    </>
  );
}
