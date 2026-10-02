'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { Lock, User } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { DimmerLoader } from '@/components/ui/dimmer-loader';
import { IconInput } from '@/components/ui/icon-input';
import { Message } from '@/components/ui/message';
import { Modal } from '@/components/ui/modal';
import { signInAction } from '../actions';
import { afterAuthNavigate } from './after-auth';

/** "Sign in to your account" (legacy layout.pug .signin-modal). */
export default function SigninModal({
  open,
  onClose,
  onForgotPassword,
}: {
  open: boolean;
  onClose: () => void;
  onForgotPassword: () => void;
}) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    startTransition(async () => {
      const result = await signInAction({ username, password });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      afterAuthNavigate(router);
    });
  };

  return (
    <Modal open={open} onClose={onClose} title="ورود به حساب کاربری">
      <p className="mt-[10px] text-center text-base font-bold">
        با بازی در این سایت، <a href="/tou" target="_blank">قوانین استفاده</a> را می‌پذیرید.
      </p>
      <form onSubmit={submit} className="relative mt-[1em] flex flex-col gap-[1em] text-center" noValidate>
        <IconInput
          icon={User}
          placeholder="نام کاربری"
          spellCheck={false}
          autoComplete="username"
          value={username}
          onChange={(event) => setUsername(event.target.value)}
        />
        <IconInput
          icon={Lock}
          type="password"
          placeholder="رمز عبور"
          autoComplete="current-password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
        />
        <Button type="submit" variant="primary" size="large" fluid disabled={pending}>
          ورود
        </Button>
        <DimmerLoader active={pending} text="در حال ورود…" />
        {error ? (
          <Message variant="negative" className="my-0">
            {error}
          </Message>
        ) : null}
        <button type="button" onClick={onForgotPassword} className="mx-auto block cursor-pointer text-ui-link hover:underline">
          رمز عبور خود را فراموش کرده‌اید؟
        </button>
      </form>
    </Modal>
  );
}
