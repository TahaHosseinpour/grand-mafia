'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { Lock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { DimmerLoader } from '@/components/ui/dimmer-loader';
import { IconInput } from '@/components/ui/icon-input';
import { Message } from '@/components/ui/message';
import { resetPasswordAction } from '../actions';

/** The form behind a password-reset email link (legacy page-resetpassword.pug). */
export default function ResetPasswordForm({ username, token }: { username: string; token: string }) {
  const [password, setPassword] = useState('');
  const [password2, setPassword2] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        setError(null);
        startTransition(async () => {
          const result = await resetPasswordAction({ username, token, password, password2 });
          if (!result.ok) {
            setError(result.error);
            return;
          }
          setDone(true);
          window.setTimeout(() => router.push('/game'), 1500);
        });
      }}
      className="relative mx-auto flex w-full max-w-[500px] flex-col gap-[1em]"
      noValidate
    >
      <IconInput icon={Lock} type="password" placeholder="رمز عبور جدید" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} />
      <IconInput icon={Lock} type="password" placeholder="تکرار رمز عبور جدید" autoComplete="new-password" value={password2} onChange={(e) => setPassword2(e.target.value)} />
      <Button type="submit" variant="primary" size="large" fluid disabled={pending || done}>
        ارسال
      </Button>
      <DimmerLoader active={pending} text="در حال تغییر رمز عبور…" />
      {error ? (
        <Message variant="negative" className="my-0">
          {error}
        </Message>
      ) : null}
      {done ? (
        <Message variant="positive" className="my-0">
          رمز عبور شما با موفقیت تغییر کرد!
        </Message>
      ) : null}
    </form>
  );
}
