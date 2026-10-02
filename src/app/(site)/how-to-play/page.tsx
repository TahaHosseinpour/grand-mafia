import type { Metadata } from 'next';
import { Bell, Gamepad2, Megaphone, MessagesSquare, Plus, Settings, Vote } from 'lucide-react';
import { PagePanel, PageTitle } from '@/components/layout/page-panel';

export const metadata: Metadata = { title: 'آموزش بازی — هیتلر ناشناس' };

const STEPS = [
  {
    icon: Gamepad2,
    title: 'لابی',
    text: 'در لابی همه‌ی میزها را می‌بینید: میزهایی که منتظر بازیکن‌اند بالاتر می‌آیند. روی هر میز بزنید تا واردش شوید؛ بازی‌های در جریان را هم می‌توانید تماشا کنید. با دکمه‌ی فیلتر، نوع بازی‌هایی را که می‌خواهید ببینید انتخاب کنید.',
  },
  {
    icon: Plus,
    title: 'ساختن میز',
    text: 'دکمه‌ی «بازی جدید» را بزنید، نام میز، نوع بازی (رتبه‌ای، غیررسمی، تمرینی یا سفارشی) و تعداد بازیکنان را انتخاب کنید. بازی خصوصی رمز می‌خواهد. گزینه‌های بیشتر مثل زمان هر تصمیم، نام‌های ناشناس و آوالون هم هست.',
  },
  {
    icon: Vote,
    title: 'نوبت شما',
    text: 'هر وقت بازی منتظر شما باشد — نامزد کردن صدراعظم، رأی دادن، دورریختن یا تصویب قانون، یا استفاده از قدرت ریاست‌جمهوری — پنجره‌ای باز می‌شود. انتخاب کنید و تأیید بزنید. اگر خواستید اول میز را ببینید، «بعداً» را بزنید و از دکمه‌ی «نوبت شماست» برگردید.',
  },
  {
    icon: Megaphone,
    title: 'ادعا',
    text: 'بعد از هر دولت، رئیس‌جمهور و صدراعظم می‌توانند با دکمه‌ی «ادعا» بگویند چه قوانینی دیدند — راست یا دروغ. ادعا در چت اعلام و در تاریخچه‌ی بازی ثبت می‌شود.',
  },
  {
    icon: MessagesSquare,
    title: 'چت',
    text: 'روی گوشی، میز و چت دو زبانه‌ی پایین صفحه‌اند. چت عمومی لابی برای همه است و هر میز چت خودش را دارد. با دکمه‌ی ایموجی، ایموجی‌های بازی را بفرستید.',
  },
  {
    icon: Settings,
    title: 'تنظیمات و پروفایل',
    text: 'از دکمه‌ی حساب در بالای صفحه به پروفایل و تنظیمات بروید: پروفایل خصوصی، فهرست سیاه، نمایش ELO، ساعت پیام‌ها و چیزهای دیگر.',
  },
  {
    icon: Bell,
    title: 'رتبه و تجربه',
    text: 'بازی‌های رتبه‌ای ELO و امتیاز تجربه می‌دهند و بازی‌های تمرینی فقط امتیاز تجربه. با ۱۰ امتیاز تجربه «باتجربه» می‌شوید و نامتان بر اساس ELO رنگ می‌گیرد.',
  },
];

export default function HowToPlayPage() {
  return (
    <PagePanel>
      <PageTitle>آموزش بازی</PageTitle>
      <p className="mb-6 text-center">
        اگر قوانین را نمی‌دانید، اول{' '}
        <a href="/rules" className="text-accent-strong underline">
          قوانین بازی
        </a>{' '}
        را بخوانید. این صفحه می‌گوید سایت چطور کار می‌کند.
      </p>
      <ol className="flex flex-col gap-3">
        {STEPS.map(({ icon: Icon, title, text }) => (
          <li key={title} className="flex gap-4 rounded-2xl bg-surface-2 p-4">
            <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-accent/15 text-accent-strong">
              <Icon className="size-6" aria-hidden />
            </span>
            <div>
              <h2 className="font-display text-[1.35rem] leading-tight text-fg">{title}</h2>
              <p className="mt-1 leading-relaxed">{text}</p>
            </div>
          </li>
        ))}
      </ol>
    </PagePanel>
  );
}
