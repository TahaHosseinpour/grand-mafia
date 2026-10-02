import { redirect } from 'next/navigation';
import { Suspense } from 'react';
import { getSession } from '@/server/auth';

/** The game client. Signed-in players only (legacy GET /game). Ported in phase 3. */
export default function GamePage() {
  return (
    <Suspense fallback={null}>
      <Game />
    </Suspense>
  );
}

async function Game() {
  const session = await getSession();
  if (!session) redirect('/');
  return (
    <main className="p-8 text-center text-site-text">
      <p>لابی بازی در حال انتقال به نسخه‌ی جدید است.</p>
    </main>
  );
}
