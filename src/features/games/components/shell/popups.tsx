'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Modal } from '@/components/ui/modal';
import { formatDate } from '@/lib/datetime';
import { emit } from '../socket';
import { setState, useClientState } from '../store';

/**
 * What stops the game until the player answers (legacy App.jsx): the terms
 * of use, a moderator warning, the new-player walkthrough, and the server's
 * alert messages.
 */

function Overlay({ children }: { children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-[9999] flex overflow-y-auto bg-ink/95 p-3 backdrop-blur-sm">
      <div className="m-auto w-full max-w-[480px] rounded-3xl border border-line bg-surface p-5 shadow-[0_20px_60px_rgb(0_0_0/0.6)]">{children}</div>
    </div>
  );
}

const checkClass = 'mt-1 size-5 shrink-0 accent-[var(--color-accent)]';

function TermsPopup({ changes }: { changes: { changeVer: string; changeDesc: string }[] }) {
  const [agreed, setAgreed] = useState(false);
  const basics = changes[0]?.changeVer === '0.0';

  return (
    <Overlay>
      <h2 className="mb-4 font-display text-[2rem] leading-tight">{basics ? 'قوانین سایت' : 'تغییرات شرایط استفاده'}</h2>
      <div className="max-h-[50dvh] overflow-y-auto rounded-2xl bg-surface-2 px-4 py-2">
        {changes.map((change) => (
          <div key={change.changeVer}>
            {!basics && <h4 className="mt-3 font-bold text-accent-strong">نسخه‌ی {change.changeVer}</h4>}
            <ul className="list-disc space-y-2 py-2 ps-5 text-fg-muted marker:text-accent">
              {change.changeDesc
                .split('\n')
                .filter(Boolean)
                .map((item) => (
                  <li key={item}>{item}</li>
                ))}
            </ul>
          </div>
        ))}
      </div>
      <p className="my-3">
        <a href="/tou" target="_blank" className="text-accent-strong underline">
          متن کامل شرایط استفاده
        </a>
      </p>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          if (agreed) emit('confirmTOU');
        }}
      >
        <label className="flex cursor-pointer items-start gap-3">
          <input type="checkbox" className={checkClass} checked={agreed} onChange={(event) => setAgreed(event.target.checked)} />
          {basics ? 'قوانین سایت را خواندم و می‌پذیرم.' : 'تغییرات شرایط استفاده را خواندم و می‌پذیرم.'}
        </label>
        <Button type="submit" variant="primary" size="lg" fluid className="mt-5" disabled={!agreed}>
          می‌پذیرم
        </Button>
      </form>
    </Overlay>
  );
}

function WarningPopup({ warning }: { warning: { text: string; time: string } }) {
  const [agreed, setAgreed] = useState(false);
  return (
    <Overlay>
      <h2 className="mb-3 font-display text-[2rem] text-fas-soft">اخطار ناظر</h2>
      <div className="mb-3 text-fg-muted">
        این اخطاری از طرف یکی از مدیران است. اگر فکر می‌کنید ناعادلانه است، می‌توانید محترمانه با مدیران در میان بگذارید.
        <br />
        <br />
        لطفاً{' '}
        <a href="/tou" className="text-accent-strong underline">
          شرایط استفاده
        </a>{' '}
        را بخوانید و رعایت کنید تا حساب شما با اقدام دیگری روبه‌رو نشود.
      </div>
      <div className="max-h-[40dvh] overflow-y-auto rounded-2xl border-s-4 border-fas bg-fas/10 p-4">
        <p className="text-[0.85rem] text-fg-faint">{formatDate(warning.time)}</p>
        <p className="mt-1 text-fg">{warning.text}</p>
      </div>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          if (agreed) emit('acknowledgeWarning');
        }}
      >
        <label className="mt-4 flex cursor-pointer items-start gap-3">
          <input type="checkbox" className={checkClass} checked={agreed} onChange={(event) => setAgreed(event.target.checked)} />
          این اخطار را دیدم و می‌دانم ادامه‌ی این رفتار ممکن است به اقدامات بیشتر روی حسابم منجر شود.
        </label>
        <Button type="submit" variant="primary" size="lg" fluid className="mt-5" disabled={!agreed}>
          متوجه شدم
        </Button>
      </form>
    </Overlay>
  );
}

const WALKTHROUGH = [
  { title: 'به هیتلر ناشناس خوش آمدید', body: <h4 className="font-bold">لطفاً پیش از شروع بازی، چند لحظه این راهنمای کوتاه را بخوانید.</h4> },
  {
    title: 'قوانین سایت و پشتیبانی',
    body: (
      <>
        <p className="mb-3">
          همان‌طور که پذیرفته‌اید، برای بازی در اینجا باید{' '}
          <a href="/tou" target="_blank" rel="noopener noreferrer">
            قوانین سایت
          </a>{' '}
          را رعایت کنید. خلاصه: محتوای نامناسب ممنوع، سخنان نفرت‌آمیز ممنوع، آزار بازیکنان ممنوع. اگر فقط در بازی‌های خصوصی بازی می‌کنید، این قوانین «سهل‌گیرانه‌تر» است.
        </p>
        <p>برای گزارش یک بازیکن، روی نام او در بازی یا لابی بزنید و گزینه‌ی «گزارش» را انتخاب کنید.</p>
      </>
    ),
  },
  {
    title: 'جزئیات سایت',
    body: (
      <>
        <h4 className="font-bold">اگر فقط برای بازی‌های خصوصی آمده‌اید:</h4>
        <p className="mb-3">
          خوش آمدید! شاید بخواهید فیلتر بازی‌های عمومی را خاموش کنید؛ این فیلتر کنار دکمه‌ی «ساخت بازی جدید» است. تنظیمات جالب دیگری هم با دکمه‌ی چرخ‌دنده در بالای صفحه پیدا می‌شود.
        </p>
        <h4 className="font-bold">بازیکنان بازی‌های عمومی:</h4>
        <p className="mb-3">شما هم خوش آمدید! احتمالاً بخواهید بازی‌های خصوصی را فیلتر کنید. این فیلترها ذخیره می‌شوند.</p>
        <p>
          لطفاً بخش{' '}
          <a href="/how-to-play" target="_blank" rel="noopener noreferrer">
            آموزش بازی
          </a>{' '}
          را بخوانید. بازی‌های رتبه‌ای (این سایت از سیستم «ELO» استفاده می‌کند: اگر از بازیکنان قوی‌تر ببرید امتیاز بیشتری می‌گیرید) برای خیلی‌ها جدی است؛ پس بهتر است پیش از
          بازی رتبه‌ای، چند بازی تمرینی یا غیررسمی بازی کنید.
        </p>
      </>
    ),
  },
  {
    title: 'پرسش‌های پرتکرار',
    body: (
      <>
        <h5 className="font-bold">چطور رنگ ویژه بگیرم یا پشت کارت خودم را بگذارم؟</h5>
        <p className="mb-3">
          بازی‌های تمرینی و رتبه‌ای امتیاز تجربه (XP) می‌دهند. با ۱۰ امتیاز تجربه «رنگین‌کمانی» می‌شوید و رنگ نامتان بر اساس ELO تعیین می‌شود. وضعیت خود را در صفحه‌ی پروفایل
          ببینید؛ کافی است روی نام خود در بالای صفحه بزنید.
        </p>
        <h5 className="font-bold">چطور مدال (جایزه‌ی فصل) بگیرم؟</h5>
        <p className="mb-3">در پایان یک فصل از نظر ELO جزو بهترین بازیکنان باشید. هر فصل سه ماه طول می‌کشد.</p>
        <h5 className="font-bold">اطلاعات من امن است؟</h5>
        <p>
          طبق{' '}
          <a href="/about" target="_blank" rel="noopener noreferrer">
            سیاست حریم خصوصی
          </a>{' '}
          رمز عبور شما به‌شکل امن رمزگذاری می‌شود و ایمیل‌تان فقط برای بازیابی رمز و تأیید حساب استفاده می‌شود. تأیید حساب را به‌شدت توصیه می‌کنیم.
        </p>
      </>
    ),
  },
  { title: 'همین بود!', body: <h4 className="font-bold">از بازی لذت ببرید!</h4> },
];

function NewPlayerModal() {
  const show = useClientState((state) => Boolean(state.userInfo.hasNotDismissedSignupModal));
  const [page, setPage] = useState(0);
  if (!show) return null;

  const dismiss = () => {
    setState((state) => ({ userInfo: { ...state.userInfo, hasNotDismissedSignupModal: false } }));
    emit('hasSeenNewPlayerModal');
  };
  const last = page === WALKTHROUGH.length - 1;

  return (
    <Modal open onClose={() => undefined} dismissible={false} title={WALKTHROUGH[page].title} titleClassName="text-accent-strong" size="default">
      <div className="space-y-1 text-fg-muted [&_a]:text-accent-strong [&_a]:underline [&_h4]:text-fg [&_h5]:text-fg">{WALKTHROUGH[page].body}</div>
      <div className="mt-4 flex justify-center gap-1.5" aria-hidden>
        {WALKTHROUGH.map((_, i) => (
          <span key={i} className={`h-1.5 rounded-full transition-all ${i === page ? 'w-6 bg-accent' : 'w-1.5 bg-line'}`} />
        ))}
      </div>
      <div className="mt-5 flex items-center justify-between gap-2">
        <Button variant="ghost" size="sm" onClick={dismiss}>
          {last ? 'بستن' : 'رد کردن'}
        </Button>
        <div className="flex gap-2">
          {page > 0 ? (
            <Button variant="secondary" onClick={() => setPage(page - 1)}>
              قبلی
            </Button>
          ) : null}
          <Button variant="primary" onClick={() => (last ? dismiss() : setPage(page + 1))}>
            {last ? 'شروع کنیم' : 'بعدی'}
          </Button>
        </div>
      </div>
    </Modal>
  );
}

function AlertQueue() {
  const message = useClientState((state) => state.alerts[0]);
  if (!message) return null;
  const close = () => setState((state) => ({ alerts: state.alerts.slice(1) }));
  return (
    <Modal open onClose={close}>
      <p className="whitespace-pre-line py-2 pe-8 text-[1.1rem] leading-relaxed text-fg">{message}</p>
      <Button variant="primary" size="lg" fluid className="mt-5" onClick={close}>
        باشه
      </Button>
    </Modal>
  );
}

export default function Popups() {
  const popup = useClientState((state) => state.popup);
  return (
    <>
      {popup?.type === 'tou' && <TermsPopup changes={popup.changes} />}
      {popup?.type === 'warning' && <WarningPopup warning={popup.warning} />}
      {!popup && <NewPlayerModal />}
      <AlertQueue />
    </>
  );
}
