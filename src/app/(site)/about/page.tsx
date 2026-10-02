import type { Metadata } from 'next';
import { PagePanel } from '@/components/layout/page-panel';

export const metadata: Metadata = { title: 'درباره — هیتلر مخفی' };

function H3({ children }: { children: React.ReactNode }) {
  return <h3 className="mb-[0.5em] mt-[1.5em] text-[1.28571429rem] font-bold text-fg">{children}</h3>;
}

/** About and privacy (legacy views/page-about.pug), translated. */
export default function AboutPage() {
  return (
    <PagePanel className="text-fg [&_p]:mb-[1em] [&_p]:text-base [&_p]:leading-[1.7]">
      <p>
        این برنامه بر پایه‌ی بازی رومیزی و از روی پروژه‌ی متن‌باز{' '}
        <a href="https://github.com/cozuya/secret-hitler" target="_blank" rel="noreferrer">
          Secret Hitler.io
        </a>{' '}
        ساخته شده است؛ طراحی و توسعه‌ی آن پروژه از{' '}
        <a href="https://www.TwoLongOs.com" target="_blank" rel="noreferrer">
          Chris Ozols
        </a>{' '}
        است. این نسخه، بازنویسی فارسیِ آن پروژه است.
      </p>
      <p>
        نکته‌ی مهم: این سایت نسخه‌ی رسمی بازی نیست و با سازندگان اصلی بازی رومیزی ارتباطی ندارد؛ بازی تحت مجوز متن‌باز خودِ آن برای
        بازی در اینجا ارائه شده است.
      </p>
      <H3>حریم خصوصی — کلی</H3>
      <p>
        رمز عبور شما به‌صورت رمزنگاری‌شده و امن نگهداری می‌شود و هیچ‌کس به آن دسترسی ندارد. نام کاربری و پیام‌های شما به‌صورت عمومی
        در دسترس نیست و توسط موتورهای جست‌وجو فهرست نمی‌شود. مدیران در پنل خصوصی مدیریت به آدرس IP شما دسترسی دارند — این فقط برای
        جلوگیری از تقلب است و هرگز عمومی نمی‌شود.
      </p>
      <H3>حریم خصوصی — ایمیل (حساب‌های تأییدشده)</H3>
      <ul className="mb-[1em] list-disc space-y-1 ps-[1.5em] text-base leading-[1.7]">
        <li>ایمیل فقط برای این کارها استفاده می‌شود: تأیید حساب و بازیابی رمز عبور.</li>
        <li>ایمیل شما تحت هیچ شرایطی برای کار دیگری، از جمله ارسال انبوه، استفاده نمی‌شود.</li>
        <li>فقط مدیران کل می‌توانند ایمیل شما را ببینند.</li>
        <li>ایمیل شما هرگز از سایت خارج، واگذار یا فروخته نمی‌شود.</li>
      </ul>
      <H3>هوش مصنوعی</H3>
      <p>اینجا از هوش مصنوعی استفاده نکنید. آرشیو بازی‌های ما هرگز برای آموزش هوش مصنوعی استفاده نشده و نخواهد شد.</p>
      <H3>منبع و مجوز</H3>
      <p>بازی Secret Hitler طراحی Max Temkin، Mike Boxleiter و Tommy Maranges با تصویرسازی Mackenzie Schubert است.</p>
      <p>
        این بازی طبق مجوز{' '}
        <a href="https://creativecommons.org/licenses/by-nc-sa/4.0/" target="_blank" rel="noreferrer">
          Creative Commons Attribution-NonCommercial-ShareAlike 4.0 International
        </a>{' '}
        منتشر شده است.
      </p>
      <p>
        صداهای بازی متن‌باز و با این مجوزها هستند:{' '}
        <a href="https://creativecommons.org/publicdomain/zero/1.0/" target="_blank" rel="noreferrer">
          zero (cc0)
        </a>
        ،{' '}
        <a href="https://creativecommons.org/licenses/by/3.0/" target="_blank" rel="noreferrer">
          by
        </a>{' '}
        و{' '}
        <a href="https://creativecommons.org/licenses/by-nc/3.0/" target="_blank" rel="noreferrer">
          by-nc
        </a>
        .
      </p>
      <p>
        فونت سایت{' '}
        <a href="https://github.com/rastikerdar/vazirmatn" target="_blank" rel="noreferrer">
          وزیرمتن
        </a>{' '}
        است.
      </p>
    </PagePanel>
  );
}
