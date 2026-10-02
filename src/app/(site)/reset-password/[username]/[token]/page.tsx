import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { Suspense } from 'react';
import { PagePanel, SectionTitle } from '@/components/layout/page-panel';
import { isPasswordResetLinkValid } from '@/features/auth';
import { ResetPasswordForm } from '@/features/auth/client';

export const metadata: Metadata = { title: 'تغییر رمز عبور — هیتلر مخفی', robots: { index: false } };

/** The page a password-reset email links to (legacy page-resetpassword.pug). */
export default function ResetPasswordPage({ params }: PageProps<'/reset-password/[username]/[token]'>) {
  return (
    <PagePanel className="text-site-heading">
      <SectionTitle underline={false}>تغییر رمز عبور</SectionTitle>
      <Suspense fallback={null}>
        <Form params={params} />
      </Suspense>
    </PagePanel>
  );
}

async function Form({ params }: { params: PageProps<'/reset-password/[username]/[token]'>['params'] }) {
  const { username, token } = await params;
  const name = decodeURIComponent(username);
  if (!(await isPasswordResetLinkValid(name, token))) notFound();
  return <ResetPasswordForm username={name} token={token} />;
}
