'use client';

import { useState, useTransition } from 'react';
import { Mail } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { DimmerLoader } from '@/components/ui/dimmer-loader';
import { IconInput } from '@/components/ui/icon-input';
import { Message } from '@/components/ui/message';
import { Modal } from '@/components/ui/modal';
import { requestPasswordResetAction } from '../actions';

/** "Request a password reset" (legacy layout.pug .password-reset-modal). */
export default function PasswordResetModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const [pending, startTransition] = useTransition();

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    startTransition(async () => {
      const result = await requestPasswordResetAction({ email });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setSent(true);
    });
  };

  return (
    <Modal open={open} onClose={onClose} title="درخواست بازیابی رمز عبور">
      <form onSubmit={submit} className="relative mt-[1em] flex flex-col gap-[1em]" noValidate>
        <IconInput
          icon={Mail}
          type="email"
          placeholder="ایمیل تأییدشده"
          spellCheck={false}
          autoComplete="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
        />
        {sent ? null : (
          <Button type="submit" variant="primary" size="large" fluid disabled={pending}>
            ارسال
          </Button>
        )}
        <DimmerLoader active={pending} text="در حال بررسی حساب…" />
        {error ? (
          <Message variant="negative" className="my-0">
            {error}
          </Message>
        ) : null}
        {sent ? (
          <Message variant="info" className="my-0">
            ایمیل بازیابی رمز عبور برای شما فرستاده شد؛ لطفاً صندوق ایمیل خود را برای لینک تغییر رمز بررسی کنید.
          </Message>
        ) : null}
      </form>
    </Modal>
  );
}
