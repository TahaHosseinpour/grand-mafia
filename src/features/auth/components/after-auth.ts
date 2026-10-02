import type { useRouter } from 'next/navigation';

/**
 * After signing in or up: observers go straight to the game, everyone else
 * stays and sees the page re-rendered with the new session (legacy site.js
 * behaviour).
 */
export function afterAuthNavigate(router: ReturnType<typeof useRouter>): void {
  if (window.location.pathname.startsWith('/observe')) {
    router.push('/game');
  } else {
    router.refresh();
  }
}
