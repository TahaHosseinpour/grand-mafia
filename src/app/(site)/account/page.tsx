import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { Suspense } from 'react';
import { PagePanel, PageTitle } from '@/components/layout/page-panel';
import { getSession } from '@/server/auth';
import { getMyAccount } from '@/features/users';
import { AccountActions } from '@/features/auth/client';

export const metadata: Metadata = { title: 'حساب من — هیتلر ناشناس' };

/** "My account" (legacy views/page-account.pug). Signed-in only. */
export default function AccountPage() {
  return (
    <PagePanel className="text-fg">
      <PageTitle underline={false}>حساب من</PageTitle>
      <Suspense fallback={<p className="text-center">در حال بارگذاری…</p>}>
        <Account />
      </Suspense>
    </PagePanel>
  );
}

async function Account() {
  if (!(await getSession())) redirect('/');
  const account = await getMyAccount();

  return (
    <div className="pb-2">
      <p className="text-center text-[1.4rem] font-bold" dir="auto">
        {account.username}
      </p>
      <dl className="mx-auto mt-4 max-w-sm divide-y divide-line rounded-2xl bg-surface-2 px-4">
        <div className="flex justify-between gap-4 py-3">
          <dt className="text-fg-muted">وضعیت حساب</dt>
          <dd className={account.verified ? 'font-bold text-ok' : 'font-bold text-gold'}>{account.verified ? 'تأییدشده' : 'تأییدنشده'}</dd>
        </div>
        <div className="flex justify-between gap-4 py-3">
          <dt className="text-fg-muted">ایمیل</dt>
          <dd dir="ltr" className="truncate font-bold">
            {account.email ?? 'ندارد'}
          </dd>
        </div>
      </dl>
      <div className="mt-6">
        <AccountActions account={account} />
      </div>
    </div>
  );
}
