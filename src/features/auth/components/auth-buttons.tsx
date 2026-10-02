'use client';

import { useState } from 'react';
import { cn } from '@/lib/utils';
import PasswordResetModal from './password-reset-modal';
import SigninModal from './signin-modal';
import SignupModal from './signup-modal';

type Open = 'signin' | 'signup' | 'reset' | null;

/**
 * The "Log In / or / Sign Up" button pair of the top menu, with the three
 * dialogs it opens (legacy layout.pug `.ui.buttons` + modals). The game
 * client's menu restyles the pair through `className`.
 */
export default function AuthButtons({ className }: { className?: string } = {}) {
  const [open, setOpen] = useState<Open>(null);
  const close = () => setOpen(null);

  return (
    <>
      <div className={cn('flex h-[38px] items-stretch overflow-hidden rounded-b-ui bg-liberal text-white', className)}>
        <button type="button" onClick={() => setOpen('signin')} className="cursor-pointer px-[1.5em] font-bold">
          ورود
        </button>
        <span className="relative z-[2] my-auto inline-flex size-[1.78571429em] items-center justify-center rounded-full bg-white text-[0.92857143rem] font-bold text-ui-text-muted shadow-[0_0_0_1px_transparent_inset]">
          یا
        </span>
        <button type="button" onClick={() => setOpen('signup')} className="cursor-pointer px-[1.5em] font-bold">
          ثبت‌نام
        </button>
      </div>
      <SigninModal open={open === 'signin'} onClose={close} onForgotPassword={() => setOpen('reset')} />
      <SignupModal open={open === 'signup'} onClose={close} />
      <PasswordResetModal open={open === 'reset'} onClose={close} />
    </>
  );
}
