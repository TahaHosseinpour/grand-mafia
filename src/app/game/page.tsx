import { redirect } from 'next/navigation';
import { Suspense } from 'react';
import { GameClient } from '@/features/games/client';
import { getMyGameBootstrap } from '@/features/users';
import { getSession } from '@/server/auth';

/** The game client for signed-in players (legacy GET /game). Visitors go to /observe. */
export default function GamePage() {
  return (
    <Suspense fallback={<div className="min-h-dvh bg-ink" />}>
      <Game />
    </Suspense>
  );
}

async function Game() {
  const session = await getSession();
  if (!session) redirect('/observe');
  const me = await getMyGameBootstrap();
  return (
    <GameClient
      user={{
        userName: me.username,
        staffRole: me.staffRole,
        verified: me.verified,
        isTournamentMod: me.isTournamentMod,
        hasNotDismissedSignupModal: me.hasNotDismissedSignupModal,
        gameSettings: me.gameSettings,
      }}
    />
  );
}
