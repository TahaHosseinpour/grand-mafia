'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { Lock, Mail, User } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { DimmerLoader } from '@/components/ui/dimmer-loader';
import { IconInput } from '@/components/ui/icon-input';
import { Message } from '@/components/ui/message';
import { Modal } from '@/components/ui/modal';
import { signUpAction } from '../actions';
import { afterAuthNavigate } from './after-auth';

/** Field hints shown while a field has focus (legacy site.js). */
const HINTS = {
  username: '۳ تا ۱۶ کاراکتر، فقط حروف انگلیسی و عدد.',
  password: '۶ تا ۲۵۵ کاراکتر.',
} as const;

type Field = keyof typeof HINTS;

/** "Sign up for an account" (legacy layout.pug .signup-modal). */
export default function SignupModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [password2, setPassword2] = useState('');
  const [email, setEmail] = useState('');
  const [isPrivate, setIsPrivate] = useState(false);
  const [touAgree, setTouAgree] = useState(false);
  const [focused, setFocused] = useState<Field | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  const togglePrivate = (checked: boolean) => {
    if (!checked) {
      setIsPrivate(false);
      return;
    }
    // Legacy asked for a typed confirmation: this choice is hard to undo.
    const answer = window.prompt(
      'آیا مطمئنید می‌خواهید فقط بتوانید در بازی‌های خصوصی شرکت کنید؟ اگر مطمئنید عبارت «تایید» را بنویسید و تأیید را بزنید؛ در غیر این صورت لغو کنید.',
      ''
    );
    setIsPrivate(answer?.trim() === 'تایید' || answer?.trim().toLowerCase() === 'ok');
  };

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    if (!touAgree) {
      setError('باید قوانین استفاده را بپذیرید.');
      return;
    }
    startTransition(async () => {
      const result = await signUpAction({ username, password, password2, email, isPrivate, touAgree: true });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      afterAuthNavigate(router);
    });
  };

  const hint = (field: Field) =>
    focused === field ? (
      <Message variant="info" className="mb-0 mt-[1em] text-start">
        {HINTS[field]}
      </Message>
    ) : null;

  return (
    <Modal open={open} onClose={onClose} title="ساخت حساب کاربری">
      <p className="mt-[10px] text-center text-base font-bold">
        با بازی در این سایت، <a href="/tou" target="_blank">قوانین استفاده</a> را می‌پذیرید.
      </p>
      <p className="mt-[10px] text-center text-[11px] font-bold text-fg-faint">
        بازیکنانی که کمتر از ۱۰ امتیاز تجربه (XP) دارند نمی‌توانند در چت عمومی یا به‌عنوان تماشاگر پیام بفرستند یا
        بازیکنی را گزارش کنند.
      </p>
      <form onSubmit={submit} className="relative mt-[1em] flex flex-col gap-[1em]" noValidate>
        <div>
          <IconInput
            icon={User}
            placeholder="نام کاربری"
            spellCheck={false}
            autoComplete="username"
            value={username}
            onChange={(event) => setUsername(event.target.value)}
            onFocus={() => setFocused('username')}
            onBlur={() => setFocused(null)}
          />
          {hint('username')}
        </div>
        <div>
          <IconInput
            icon={Lock}
            type="password"
            placeholder="رمز عبور"
            maxLength={255}
            autoComplete="new-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            onFocus={() => setFocused('password')}
            onBlur={() => setFocused(null)}
          />
          {hint('password')}
        </div>
        <IconInput
          icon={Lock}
          type="password"
          placeholder="تکرار رمز عبور"
          maxLength={255}
          autoComplete="new-password"
          value={password2}
          onChange={(event) => setPassword2(event.target.value)}
        />
        <div>
          <h4 className="mb-[0.5em] font-bold text-fas-soft">ایمیل اختیاری است</h4>
          <IconInput
            icon={Mail}
            type="email"
            placeholder="ایمیل"
            maxLength={255}
            spellCheck={false}
            autoComplete="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />
        </div>
        <label className="flex items-start gap-[5px] text-[0.92857143rem] font-bold">
          <input type="checkbox" className="mt-[3px] size-4 accent-[var(--color-accent)]" checked={isPrivate} onChange={(event) => togglePrivate(event.target.checked)} />
          <span>
            <span className="text-fg-muted">
              پیش از انتخاب با دقت بخوانید: گزینه‌ی «فقط بازی‌های خصوصی» — نام شما در فهرست بازیکنان دیده نمی‌شود، نمی‌توانید در
              چت عمومی پیام بفرستید،{' '}
            </span>
            <b className="text-fg">و نمی‌توانید در بازی‌های عمومی شرکت کنید.</b>
          </span>
        </label>
        <label className="flex items-start gap-[5px] text-[0.92857143rem] font-bold">
          <input type="checkbox" className="mt-[3px] size-4 accent-[var(--color-accent)]" checked={touAgree} onChange={(event) => setTouAgree(event.target.checked)} />
          <span className="text-fg-muted">
            <a href="/tou" target="_blank">
              قوانین استفاده
            </a>{' '}
            را خوانده‌ام و می‌پذیرم.
          </span>
        </label>
        <Button type="submit" variant="primary" size="large" fluid disabled={pending}>
          ثبت‌نام
        </Button>
        <DimmerLoader active={pending} text="در حال ثبت‌نام…" />
        {error ? (
          <Message variant="negative" className="my-0">
            {error}
          </Message>
        ) : null}
      </form>
    </Modal>
  );
}
