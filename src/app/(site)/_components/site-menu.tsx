'use client';

import { Menu, X } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Suspense, useState } from 'react';
import { buttonClasses } from '@/components/ui/button';
import { cn } from '@/lib/utils';

/** The site's pages, in menu order. */
export const SITE_LINKS = [
  { href: '/', label: 'خانه' },
  { href: '/rules', label: 'قوانین بازی' },
  { href: '/how-to-play', label: 'آموزش بازی' },
  { href: '/stats', label: 'آمار' },
  { href: '/tou', label: 'قوانین استفاده' },
  { href: '/about', label: 'درباره' },
] as const;

const LINK_BASE = 'rounded-xl px-3 py-2 text-[0.95rem] text-paper/75 hover:bg-black/20 hover:text-paper';

/**
 * One menu link; highlights itself on its own page. Reading the pathname is a
 * request-time read on dynamic routes, so it sits in its own Suspense
 * boundary with the plain link as fallback — the menu itself never suspends.
 */
function NavLink({ href, label, className, onNavigate }: { href: string; label: string; className?: string; onNavigate?: () => void }) {
  return (
    <Suspense
      fallback={
        <Link href={href} className={cn(LINK_BASE, className)}>
          {label}
        </Link>
      }
    >
      <ActiveNavLink href={href} label={label} className={className} onNavigate={onNavigate} />
    </Suspense>
  );
}

function ActiveNavLink({ href, label, className, onNavigate }: { href: string; label: string; className?: string; onNavigate?: () => void }) {
  const active = usePathname() === href;
  return (
    <Link href={href} onClick={onNavigate} aria-current={active ? 'page' : undefined} className={cn(LINK_BASE, className, active && 'bg-black/25 font-bold text-paper')}>
      {label}
    </Link>
  );
}

/**
 * The top bar of the site pages: the name, the page links (in a sheet on
 * phones), the account area and the way into the game.
 */
export default function SiteMenu({ signedIn, account }: { signedIn: boolean; account: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const lobbyHref = signedIn ? '/game' : '/observe';

  return (
    <>
      <header className="sticky top-0 z-40 bg-header shadow-[0_2px_12px_rgb(0_0_0/0.4)]">
        <nav className="mx-auto flex h-14 max-w-[1200px] items-center gap-2 px-3">
          <button type="button" onClick={() => setOpen(true)} aria-label="منو" className="flex size-10 cursor-pointer items-center justify-center rounded-full text-paper hover:bg-black/25 lg:hidden">
            <Menu className="size-6" />
          </button>
          <Link href="/" className="me-3 font-display text-[1.55rem] leading-none text-paper/90 [text-shadow:0_2px_0_rgb(0_0_0/0.35)] hover:text-paper">
            هیتلر ناشناس
          </Link>
          <div className="hidden items-center gap-0.5 lg:flex">
            {SITE_LINKS.map((link) => (
              <NavLink key={link.href} href={link.href} label={link.label} />
            ))}
          </div>
          <div className="ms-auto flex items-center gap-2">
            {account}
            <Link href={lobbyHref} className={buttonClasses({ variant: 'primary', size: 'sm', className: 'text-white hover:text-white' })}>
              لابی بازی
            </Link>
          </div>
        </nav>
      </header>

      {open ? (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-[2px]" onClick={() => setOpen(false)}>
          <aside className="absolute inset-y-0 start-0 flex w-72 flex-col gap-1 bg-surface p-4 shadow-[0_0_40px_rgb(0_0_0/0.5)]" onClick={(event) => event.stopPropagation()}>
            <div className="mb-3 flex items-center justify-between">
              <span className="font-display text-[1.5rem]">هیتلر ناشناس</span>
              <button type="button" onClick={() => setOpen(false)} aria-label="بستن" className="flex size-9 cursor-pointer items-center justify-center rounded-full text-fg-muted hover:bg-surface-3">
                <X className="size-5" />
              </button>
            </div>
            <Link href={lobbyHref} onClick={() => setOpen(false)} className={buttonClasses({ variant: 'primary', fluid: true, className: 'mb-2 text-white hover:text-white' })}>
              لابی بازی
            </Link>
            {SITE_LINKS.map((link) => (
              <NavLink key={link.href} href={link.href} label={link.label} onNavigate={() => setOpen(false)} className="py-3 text-[1.05rem] text-fg-muted hover:bg-surface-3 hover:text-fg" />
            ))}
          </aside>
        </div>
      ) : null}
    </>
  );
}
