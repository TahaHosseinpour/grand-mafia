import Link from 'next/link';
import { getSession } from '@/server/auth';
import { AuthButtons } from '@/features/auth/client';
import SiteMenu from './site-menu';

/** The top menu with the visitor's account area (reads the session cookie). */
export default async function SiteHeader() {
  const session = await getSession();

  const account = session ? (
    <Link
      href="/account"
      aria-label={`حساب کاربری ${session.username}`}
      className="flex size-10 items-center justify-center rounded-full bg-black/25 font-display text-[1.3rem] text-paper ring-1 ring-white/15 hover:bg-black/40 hover:text-paper"
    >
      {session.username.slice(0, 1).toUpperCase()}
    </Link>
  ) : (
    <AuthButtons className="hidden h-9 rounded-xl bg-black/25 text-[0.9rem] text-paper ring-1 ring-white/15 sm:flex [&_button]:px-3" />
  );

  return <SiteMenu signedIn={Boolean(session)} account={account} />;
}

/** Rendered while the session is read: same frame, no account area. */
export function SiteHeaderFallback() {
  return <SiteMenu signedIn={false} account={null} />;
}
