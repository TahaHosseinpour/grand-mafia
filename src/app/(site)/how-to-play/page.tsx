import type { Metadata } from 'next';
import Image from 'next/image';
import { PagePanel, PageTitle, SectionTitle } from '@/components/layout/page-panel';

export const metadata: Metadata = { title: 'آموزش بازی — هیتلر مخفی' };

const SECTIONS = [
  {
    title: 'نمای پیش‌فرض',
    text: 'روی بازی‌های وسط صفحه بزنید تا واردشان شوید. می‌توانید بازی‌های در جریان را تماشا کنید، وارد بازی‌هایی شوید که به بازیکن نیاز دارند (بالای فهرست) و روی صندلی بنشینید، بازی خودتان را بسازید، یا به صفحه‌ی تنظیمات بروید و پروفایل بازیکنان دیگر را ببینید.',
    image: '/images/DefaultView.png',
    width: 1920,
    height: 1080,
  },
  {
    title: 'تنظیمات بازیکن',
    text: 'وقتی به وضعیت «رنگین‌کمانی» برسید، یعنی ۱۰ امتیاز تجربه (XP) کسب کنید، می‌توانید پشت کارت دلخواه بارگذاری کنید.',
    image: '/images/PlayerSettings.png',
    width: 1920,
    height: 1080,
  },
  {
    title: 'پروفایل بازیکن',
    text: 'آمار و بازی‌های اخیر هر بازیکن در پروفایل او دیده می‌شود.',
    image: '/images/PlayerProfile.png',
    width: 1920,
    height: 1080,
  },
  {
    title: 'ساخت بازی',
    text: 'با کشیدن نوار لغزنده، حداقل و حداکثر تعداد بازیکنان بازی را تعیین کنید؛ تنظیمات بسیار دیگری هم در دسترس است.',
    image: '/images/CreateGamesView.png',
    width: 1920,
    height: 1080,
  },
  {
    title: 'بازیِ شروع‌نشده',
    text: 'یک بازی تازه که فقط سازنده‌اش روی صندلی نشسته است. از گوشه‌ی بالا می‌توانید پیام‌های چت را فیلتر کنید.',
    image: '/images/UnstartedGameView.png',
    width: 1920,
    height: 1080,
  },
] as const;

/** How to play (legacy views/page-howtoplay.pug), translated. */
export default function HowToPlayPage() {
  return (
    <PagePanel className="text-site-heading">
      <PageTitle underline={false}>آموزش بازی هیتلر مخفی</PageTitle>
      <SectionTitle underline={false}>منابع</SectionTitle>
      <p className="text-center">
        <a href="/rules">قوانین کامل بازی</a>
      </p>
      {SECTIONS.map((section) => (
        <section key={section.title}>
          <SectionTitle underline={false}>{section.title}</SectionTitle>
          <p className="mb-[1em] text-center text-[14px]">{section.text}</p>
          <Image
            src={section.image}
            alt={section.title}
            width={section.width}
            height={section.height}
            className="mx-auto mb-[10px] block h-auto max-w-[90%] shadow-[0_3px_4px_1px_#333]"
          />
        </section>
      ))}
    </PagePanel>
  );
}
