import Link from 'next/link';
import { Suspense } from 'react';
import { getSession } from '@/server/auth';
import OnlineCount from './_components/online-count';

/**
 * Home: the seasonal banner linking to the lobby (legacy page-home.pug).
 * Signed-in players go to /game, visitors to /observe.
 */
export default function HomePage() {
  return (
    <Suspense fallback={<Banner href="/observe" />}>
      <SignedInBanner />
    </Suspense>
  );
}

async function SignedInBanner() {
  const session = await getSession();
  return <Banner href={session ? '/game' : '/observe'} />;
}

function Banner({ href }: { href: string }) {
  return (
    <Link href={href} aria-label="لابی بازی" className="block">
      <div
        className="group relative mx-auto mt-[55px] w-[97%] rounded-ui bg-[#14204f] bg-[url('/images/banner-summer.png')] bg-cover bg-center bg-no-repeat pt-[40%] shadow-[0_1px_2px_0_rgb(34_36_38/0.15)] hover:bg-[url('/images/banner-summer.gif')] sm:w-full sm:pt-[43%] min-[1130px]:h-[460px] min-[1130px]:pt-0"
      >
        <OnlineCount />
      </div>
    </Link>
  );
}
