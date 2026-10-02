import { GameClient } from '@/features/games/client';

/** The game client for visitors: watch the lobby and the tables (legacy GET /observe). */
export default function ObservePage() {
  return <GameClient user={null} />;
}
