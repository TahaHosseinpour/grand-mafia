import { BookOpen, Gamepad2, ScrollText } from 'lucide-react';
import Link from 'next/link';
import { Suspense } from 'react';
import { buttonClasses } from '@/components/ui/button';
import { PolicyCard, RoleCard } from '@/features/games/client';
import { getSession } from '@/server/auth';
import OnlineCount from './_components/online-count';

/** Home: what the game is, and the way into the lobby. */
export default function HomePage() {
  return (
    <main className="px-4">
      <section className="relative mt-6 overflow-hidden rounded-[2rem] bg-gradient-to-br from-[#3a1c12] via-surface to-[#1d3440] px-6 py-10 sm:px-12 sm:py-14">
        <div className="relative z-10 max-w-xl">
          <OnlineCount />
          <h1 className="mt-4 font-display text-[3rem] leading-[1.05] text-paper sm:text-[4.2rem]">هیتلر مخفی</h1>
          <p className="mt-3 text-[1.1rem] leading-relaxed text-fg-muted sm:text-[1.2rem]">
            بازی استنتاج اجتماعی برای ۵ تا ۱۰ نفر. لیبرال‌ها باید هیتلر را پیدا کنند؛ فاشیست‌ها باید پنهان بمانند و او را به قدرت برسانند. آنلاین، رایگان و بدون تبلیغ.
          </p>
          <div className="mt-7 flex flex-wrap gap-3">
            <Suspense fallback={<LobbyLink href="/observe" />}>
              <SignedInLobbyLink />
            </Suspense>
            <Link href="/how-to-play" className={buttonClasses({ variant: 'secondary', size: 'lg' })}>
              آموزش بازی
            </Link>
          </div>
        </div>
        <div aria-hidden className="pointer-events-none absolute -bottom-6 end-[-2rem] hidden rotate-[-8deg] gap-3 opacity-90 md:flex">
          <PolicyCard policy="liberal" className="w-28 translate-y-6 rotate-[-6deg]" />
          <RoleCard role="hitler" className="w-36" />
          <PolicyCard policy="fascist" className="w-28 translate-y-6 rotate-[6deg]" />
        </div>
      </section>

      <section className="mt-6 grid gap-3 sm:grid-cols-3">
        {[
          { href: '/rules', icon: ScrollText, title: 'قوانین بازی', text: 'نقش‌ها، انتخابات، قدرت‌های ریاست‌جمهوری و شرط‌های برد.' },
          { href: '/how-to-play', icon: BookOpen, title: 'آموزش', text: 'از ساختن میز تا رأی دادن، قدم به قدم.' },
          { href: '/stats', icon: Gamepad2, title: 'آمار', text: 'لیبرال‌ها بیشتر می‌برند یا فاشیست‌ها؟' },
        ].map(({ href, icon: Icon, title, text }) => (
          <Link key={href} href={href} className="group rounded-3xl bg-surface p-5 text-fg transition-colors hover:bg-surface-2 hover:text-fg">
            <Icon className="size-7 text-accent-strong" aria-hidden />
            <h2 className="mt-3 font-display text-[1.5rem] leading-tight">{title}</h2>
            <p className="mt-1 text-fg-muted">{text}</p>
          </Link>
        ))}
      </section>
    </main>
  );
}

async function SignedInLobbyLink() {
  const session = await getSession();
  return <LobbyLink href={session ? '/game' : '/observe'} />;
}

function LobbyLink({ href }: { href: string }) {
  return (
    <Link href={href} className={buttonClasses({ variant: 'primary', size: 'lg', className: 'text-white hover:text-white' })}>
      ورود به لابی
    </Link>
  );
}
