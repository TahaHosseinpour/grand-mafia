'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Suspense, useState } from 'react';
import { buttonClasses } from '@/components/ui/button';
import { cn } from '@/lib/utils';

/** The site's pages, in menu order (legacy layout.pug). */
export const SITE_LINKS = [
  { href: '/', label: 'خانه' },
  { href: '/rules', label: 'قوانین بازی' },
  { href: '/how-to-play', label: 'آموزش بازی' },
  { href: '/stats', label: 'آمار' },
  { href: '/tou', label: 'قوانین استفاده' },
  { href: '/about', label: 'درباره' },
] as const;

const LINK_BASE = 'flex items-center border-b-2 border-transparent px-[1.14285714em] text-white/70 hover:text-white';

/**
 * One top-menu link; highlights itself on its own page. Reading the pathname
 * is a request-time read on dynamic routes, so it sits in its own Suspense
 * boundary with the plain link as fallback — the menu itself never suspends.
 */
function NavLink({ href, label }: { href: string; label: string }) {
  return (
    <Suspense fallback={<Link href={href} className={LINK_BASE}>{label}</Link>}>
      <ActiveNavLink href={href} label={label} />
    </Suspense>
  );
}

function ActiveNavLink({ href, label }: { href: string; label: string }) {
  const active = usePathname() === href;
  return (
    <Link
      href={href}
      aria-current={active ? 'page' : undefined}
      className={cn(LINK_BASE, active && 'border-white font-bold text-white')}
    >
      {label}
    </Link>
  );
}

function SidebarLink({ href, label, onNavigate }: { href: string; label: string; onNavigate: () => void }) {
  const base = 'border-t border-white/8 px-[1.14285714em] py-[0.92857143em] text-white/90 hover:bg-white/8 hover:text-white';
  return (
    <Suspense fallback={<Link href={href} className={base}>{label}</Link>}>
      <ActiveSidebarLink href={href} label={label} base={base} onNavigate={onNavigate} />
    </Suspense>
  );
}

function ActiveSidebarLink({ href, label, base, onNavigate }: { href: string; label: string; base: string; onNavigate: () => void }) {
  return (
    <Link href={href} onClick={onNavigate} className={cn(base, usePathname() === href && 'bg-white/15 font-bold text-white')}>
      {label}
    </Link>
  );
}

/**
 * Top menu: the "Game Lobby" button, the page links and the account area.
 * Below 1104px the links move into a sidebar opened by «منو», as before.
 */
export default function SiteMenu({ signedIn, account }: { signedIn: boolean; account: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const lobbyHref = signedIn ? '/game' : '/observe';

  return (
    <>
      <nav className="fixed inset-x-0 top-0 z-[101] mx-auto flex h-10 max-w-[1128px] items-stretch bg-linear-to-l from-black via-[#100000] to-black text-white">
        <Link href={lobbyHref} className={buttonClasses({ variant: 'lobby', className: 'me-1 hidden rounded-t-none text-white hover:text-white min-[1105px]:inline-block' })}>
          لابی بازی
        </Link>
        <button
          type="button"
          onClick={() => setSidebarOpen(true)}
          className={buttonClasses({ variant: 'lobby', className: 'rounded-t-none text-white min-[1105px]:hidden' })}
        >
          منو
        </button>
        <div className="hidden items-stretch min-[1105px]:flex">
          {SITE_LINKS.map((link) => (
            <NavLink key={link.href} href={link.href} label={link.label} />
          ))}
        </div>
        <div className="ms-auto flex items-stretch">{account}</div>
      </nav>

      {sidebarOpen ? (
        <div className="fixed inset-0 z-[102] bg-black/50" onClick={() => setSidebarOpen(false)}>
          <aside
            className="absolute inset-y-0 start-0 flex w-[260px] flex-col bg-[#1b1c1d] py-1 text-white shadow-[0_0_20px_rgb(0_0_0/0.15)]"
            onClick={(event) => event.stopPropagation()}
          >
            <Link href={lobbyHref} className="px-[1.14285714em] py-[0.92857143em] text-white/90 hover:bg-white/8 hover:text-white">
              لابی بازی
            </Link>
            {SITE_LINKS.map((link) => (
              <SidebarLink key={link.href} href={link.href} label={link.label} onNavigate={() => setSidebarOpen(false)} />
            ))}
          </aside>
        </div>
      ) : null}
    </>
  );
}
