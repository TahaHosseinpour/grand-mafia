'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { Lock, Mail } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { DimmerLoader } from '@/components/ui/dimmer-loader';
import { IconInput } from '@/components/ui/icon-input';
import { Message } from '@/components/ui/message';
import { Modal } from '@/components/ui/modal';
import type { AccountDTO } from '@/features/users';
import {
  changeEmailAction,
  changePasswordAction,
  deleteAccountAction,
  requestVerificationAction,
} from '../actions';

type Open = 'password' | 'email' | 'verification-sent' | 'delete' | null;

/** One small form inside a modal: fields, submit, loader, error/success. */
function ModalForm({
  onSubmit,
  pending,
  loadingText,
  error,
  success,
  children,
}: {
  onSubmit: () => void;
  pending: boolean;
  loadingText: string;
  error: string | null;
  success: string | null;
  children: React.ReactNode;
}) {
  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit();
      }}
      className="relative mt-[1em] flex flex-col gap-[1em]"
      noValidate
    >
      {children}
      <Button type="submit" variant="primary" size="large" fluid disabled={pending || Boolean(success)}>
        ارسال
      </Button>
      <DimmerLoader active={pending} text={loadingText} />
      {error ? (
        <Message variant="negative" className="my-0">
          {error}
        </Message>
      ) : null}
      {success ? (
        <Message variant="positive" className="my-0">
          {success}
        </Message>
      ) : null}
    </form>
  );
}

/**
 * The buttons of the account page and their dialogs (legacy
 * page-account.pug + site.js): change password, add/change email, request a
 * verification email, delete the account.
 */
export default function AccountActions({ account }: { account: AccountDTO }) {
  const [open, setOpen] = useState<Open>(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [password, setPassword] = useState('');
  const [password2, setPassword2] = useState('');
  const [email, setEmail] = useState('');

  const show = (which: Open) => {
    setError(null);
    setSuccess(null);
    setPassword('');
    setPassword2('');
    setEmail('');
    setOpen(which);
  };
  const close = () => setOpen(null);

  const buttonClass = 'mx-auto mt-3 flex w-full max-w-sm';

  return (
    <>
      {account.email ? (
        <>
          {!account.verified ? (
            <Button
              variant="primary"
              className={buttonClass}
              disabled={pending}
              onClick={() =>
                startTransition(async () => {
                  const result = await requestVerificationAction();
                  if (result.ok) setOpen('verification-sent');
                  else window.alert(result.error);
                })
              }
            >
              درخواست ایمیل تأیید جدید
            </Button>
          ) : null}
          <Button variant="secondary" className={buttonClass} onClick={() => show('email')}>
            تغییر آدرس ایمیل
          </Button>
        </>
      ) : (
        <Button variant="primary" className={buttonClass} onClick={() => show('email')}>
          افزودن ایمیل و ارسال ایمیل تأیید
        </Button>
      )}
      <Button variant="secondary" className={buttonClass} onClick={() => show('password')}>
        تغییر رمز عبور
      </Button>
      <Button variant="negative" className={buttonClass} onClick={() => show('delete')}>
        حذف حساب کاربری
      </Button>

      <Modal open={open === 'password'} onClose={close} title="تغییر رمز عبور">
        <ModalForm
          pending={pending}
          loadingText="در حال تغییر رمز عبور…"
          error={error}
          success={success}
          onSubmit={() =>
            startTransition(async () => {
              setError(null);
              const result = await changePasswordAction({ newPassword: password, newPasswordConfirm: password2 });
              if (result.ok) setSuccess('رمز عبور شما با موفقیت تغییر کرد!');
              else setError(result.error);
            })
          }
        >
          <IconInput icon={Lock} type="password" placeholder="رمز عبور جدید" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} />
          <IconInput icon={Lock} type="password" placeholder="تکرار رمز عبور جدید" autoComplete="new-password" value={password2} onChange={(e) => setPassword2(e.target.value)} />
        </ModalForm>
      </Modal>

      <Modal
        open={open === 'email'}
        onClose={close}
        title={account.email ? 'تغییر ایمیل (و ارسال ایمیل تأیید جدید)' : `افزودن ایمیل برای حساب ${account.username}`}
      >
        {account.email ? null : (
          <ul className="list-disc space-y-1 ps-[1.5em] pt-[0.5em] text-[0.92857143rem] text-fg-muted">
            <li>ایمیل فقط برای تأیید حساب و بازیابی رمز عبور استفاده می‌شود.</li>
            <li>ایمیل شما هرگز برای هیچ کار دیگری، از جمله ارسال انبوه، استفاده نمی‌شود.</li>
            <li>فقط مدیران کل می‌توانند ایمیل شما را ببینند.</li>
            <li>ایمیل شما هرگز از سایت خارج، واگذار یا فروخته نمی‌شود.</li>
          </ul>
        )}
        <ModalForm
          pending={pending}
          loadingText="در حال ثبت ایمیل…"
          error={error}
          success={success}
          onSubmit={() =>
            startTransition(async () => {
              setError(null);
              const result = await changeEmailAction({ email });
              if (result.ok) {
                setSuccess(email ? 'ایمیل ثبت شد؛ لطفاً صندوق ایمیل خود را برای لینک تأیید بررسی کنید.' : 'ایمیل حذف شد.');
                window.setTimeout(() => router.refresh(), 2500);
              } else setError(result.error);
            })
          }
        >
          <IconInput icon={Mail} type="email" placeholder="ایمیل" spellCheck={false} autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />
        </ModalForm>
      </Modal>

      <Modal open={open === 'verification-sent'} onClose={close} title="ایمیل ارسال شد!">
        <p className="py-[1em]">لطفاً برای تأیید حساب، صندوق ایمیل خود را بررسی کنید.</p>
      </Modal>

      <Modal open={open === 'delete'} onClose={close} title={`حذف حساب ${account.username}`}>
        <Message variant="negative" className="mb-0">
          این کار برگشت‌پذیر نیست.
        </Message>
        <ModalForm
          pending={pending}
          loadingText="در حال حذف حساب…"
          error={error}
          success={success}
          onSubmit={() =>
            startTransition(async () => {
              setError(null);
              const result = await deleteAccountAction({ password });
              if (result.ok) {
                setSuccess('حساب شما با موفقیت حذف شد.');
                window.setTimeout(() => {
                  router.push('/');
                  router.refresh();
                }, 1500);
              } else setError(result.error);
            })
          }
        >
          <IconInput icon={Lock} type="password" placeholder="رمز عبور فعلی شما" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} />
        </ModalForm>
      </Modal>
    </>
  );
}
