import Link from 'next/link';
import { getSession } from '@/server/auth';
import { AuthButtons, SignOutLink } from '@/features/auth/client';
import SiteMenu from './site-menu';

/** The top menu with the visitor's account area (reads the session cookie). */
export default async function SiteHeader() {
  const session = await getSession();

  const account = session ? (
    <div className="flex items-center gap-5 pe-2 text-[0.92857143rem]">
      <SignOutLink className="text-white/80 hover:text-white" />
      <Link href="/account" className="text-online hover:text-online">
        حساب کاربری {session.username}
      </Link>
    </div>
  ) : (
    <AuthButtons />
  );

  return <SiteMenu signedIn={Boolean(session)} account={account} />;
}

/** Rendered while the session is read: same frame, no account area. */
export function SiteHeaderFallback() {
  return <SiteMenu signedIn={false} account={null} />;
}
