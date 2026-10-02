'use client';

import { ArrowRight, LogOut, Settings, UserRound } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import { AuthButtons, SignOutLink } from '@/features/auth/client';
import { Modal } from '@/components/ui/modal';
import { cn } from '@/lib/utils';
import { useClientState } from '../store';

/**
 * The top bar: back to the lobby (when not there), the name of the game in
 * the middle, and the account menu — or the sign-in buttons for a visitor.
 */

function AccountMenu({ userName }: { userName: string }) {
  const [open, setOpen] = useState(false);
  const inRunningGame = useClientState((state) => Boolean(state.userInfo.isSeated && state.gameInfo?.gameState.isStarted && !state.gameInfo.gameState.isCompleted));
  const itemClass = 'flex items-center gap-3 rounded-xl px-4 py-3 text-[1.05rem] text-fg hover:bg-surface-3 hover:text-fg';

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="حساب کاربری"
        className="flex size-10 cursor-pointer items-center justify-center rounded-full bg-black/25 font-display text-[1.3rem] text-paper ring-1 ring-white/15 hover:bg-black/40"
      >
        {userName.slice(0, 1).toUpperCase()}
      </button>
      <Modal open={open} onClose={() => setOpen(false)} title={userName}>
        <nav className="flex flex-col gap-1" onClick={() => setOpen(false)}>
          <a href={`#/profile/${encodeURIComponent(userName)}`} className={itemClass}>
            <UserRound className="size-5 text-fg-muted" /> پروفایل من
          </a>
          <a href="#/settings" className={cn(itemClass, inRunningGame && 'pointer-events-none opacity-40')}>
            <Settings className="size-5 text-fg-muted" /> تنظیمات
          </a>
          <Link href="/" className={itemClass}>
            <ArrowRight className="size-5 text-fg-muted" /> صفحه‌ی اصلی سایت
          </Link>
          <span className={cn(itemClass, 'text-danger')}>
            <LogOut className="size-5" />
            <SignOutLink className="flex-1 text-danger hover:text-danger" />
          </span>
        </nav>
      </Modal>
    </>
  );
}

export default function AppHeader() {
  const userName = useClientState((state) => state.userInfo.userName);
  const midSection = useClientState((state) => state.midSection);
  const safeForWork = useClientState((state) => Boolean(state.userInfo.gameSettings?.safeForWork));
  const inLobby = midSection === 'default';

  return (
    <header className="sticky top-0 z-40 bg-header shadow-[0_2px_12px_rgb(0_0_0/0.4)]">
      <div className="mx-auto grid h-14 max-w-[1400px] grid-cols-[1fr_auto_1fr] items-center px-3">
        <div className="flex justify-start">
          {!inLobby ? (
            <a href="#/" aria-label="بازگشت به لابی" className="flex size-10 items-center justify-center rounded-full text-paper hover:bg-black/25 hover:text-paper">
              <ArrowRight className="size-6" />
            </a>
          ) : null}
        </div>
        <a href="#/" className="font-display text-[1.65rem] leading-none text-paper/90 [text-shadow:0_2px_0_rgb(0_0_0/0.35)] hover:text-paper">
          {safeForWork ? 'بازی' : 'هیتلر ناشناس'}
        </a>
        <div className="flex justify-end">
          {userName ? (
            <AccountMenu userName={userName} />
          ) : (
            <AuthButtons className="h-9 rounded-xl bg-accent text-[0.9rem] shadow-[0_3px_0_var(--color-accent-deep)] [&_button]:px-3" />
          )}
        </div>
      </div>
    </header>
  );
}
