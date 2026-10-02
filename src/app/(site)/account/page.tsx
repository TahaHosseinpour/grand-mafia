import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { Suspense } from 'react';
import { PagePanel, PageTitle } from '@/components/layout/page-panel';
import { getSession } from '@/server/auth';
import { getMyAccount } from '@/features/users';
import { AccountActions } from '@/features/auth/client';

export const metadata: Metadata = { title: 'حساب من — هیتلر مخفی' };

/** "My account" (legacy views/page-account.pug). Signed-in only. */
export default function AccountPage() {
  return (
    <PagePanel className="text-site-heading">
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
    <div className="pb-[1em]">
      <h3 className="text-center text-[1.28571429rem] font-bold text-fascist">
        وضعیت تأیید حساب:{' '}
        {account.verified ? <span className="text-[royalblue]">تأییدشده</span> : <span className="text-[bisque]">تأییدنشده</span>}
      </h3>
      <h3 className="mb-[1em] text-center text-[1.28571429rem] font-bold text-fascist">
        آدرس ایمیل:{' '}
        {account.email ? (
          <span dir="ltr" className="text-[royalblue]">
            {account.email}
          </span>
        ) : (
          <span className="text-[bisque]">ندارد</span>
        )}
      </h3>
      <AccountActions account={account} />
    </div>
  );
}
