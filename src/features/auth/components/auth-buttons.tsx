'use client';

import { useState } from 'react';
import { cn } from '@/lib/utils';
import PasswordResetModal from './password-reset-modal';
import SigninModal from './signin-modal';
import SignupModal from './signup-modal';

type Open = 'signin' | 'signup' | 'reset' | null;

/**
 * The «ورود | ثبت‌نام» pair of the top bars, with the three dialogs it opens.
 * Each bar restyles the pair through `className`.
 */
export default function AuthButtons({ className }: { className?: string } = {}) {
  const [open, setOpen] = useState<Open>(null);
  const close = () => setOpen(null);

  return (
    <>
      <div className={cn('flex h-10 items-stretch overflow-hidden rounded-xl bg-surface-3 text-fg', className)}>
        <button type="button" onClick={() => setOpen('signin')} className="cursor-pointer px-4 font-bold hover:bg-black/15">
          ورود
        </button>
        <span aria-hidden className="my-2 w-px bg-current opacity-25" />
        <button type="button" onClick={() => setOpen('signup')} className="cursor-pointer px-4 font-bold hover:bg-black/15">
          ثبت‌نام
        </button>
      </div>
      <SigninModal open={open === 'signin'} onClose={close} onForgotPassword={() => setOpen('reset')} />
      <SignupModal open={open === 'signup'} onClose={close} />
      <PasswordResetModal open={open === 'reset'} onClose={close} />
    </>
  );
}
