'use client';

import { useRouter } from 'next/navigation';
import { signOutAction } from '../actions';

/** The top menu's «خروج» link (legacy `a#logout`). */
export default function SignOutLink({ className }: { className?: string }) {
  const router = useRouter();
  return (
    <a
      href="#"
      className={className}
      onClick={async (event) => {
        event.preventDefault();
        await signOutAction();
        router.push('/');
        router.refresh();
      }}
    >
      خروج
    </a>
  );
}
