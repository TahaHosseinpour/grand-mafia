import { connection } from 'next/server';
import { defineRoute } from '@/server/http';
import { countOnlinePlayers } from '@/features/games';

/** Number of players online, for the home page badge (legacy URL kept). */
export const GET = defineRoute({
  handler: async () => {
    await connection();
    return Response.json({ count: countOnlinePlayers() }, { headers: { 'Cache-Control': 'no-store' } });
  },
});
