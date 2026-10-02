import 'server-only';
import prisma from '@/server/db';
import { engineStore } from './engine/store';
import type { FinishedGameRecord } from './types';
import type { Prisma } from '@/generated/prisma/client';

/** Players connected right now (legacy GET /online-playercount). Public. */
export function countOnlinePlayers(): number {
  return engineStore().userList.length;
}

/**
 * Stores a game, or — when the game was already recorded (it ended, then its
 * table was abandoned) — refreshes the record. Called by the engine with a
 * game it owns: there is no session and no client input behind it.
 */
export async function saveFinishedGameForEngine(record: FinishedGameRecord): Promise<void> {
  const data = {
    name: record.name,
    flag: record.flag,
    season: record.season,
    playerCount: record.playerCount,
    playerChats: record.playerChats,
    winningPlayers: record.winningPlayers,
    losingPlayers: record.losingPlayers,
    winningTeam: record.winningTeam,
    isRainbow: record.isRainbow,
    eloMinimum: record.eloMinimum,
    casualGame: record.casualGame,
    practiceGame: record.practiceGame,
    customGame: record.customGame,
    unlistedGame: record.unlistedGame,
    isVerifiedOnly: record.isVerifiedOnly,
    completed: record.completed,
    settings: record.settings as Prisma.InputJsonValue,
    chats: record.chats as Prisma.InputJsonValue,
    hiddenInfoChat: record.hiddenInfoChat as Prisma.InputJsonValue,
    summary: record.summary === null ? undefined : (record.summary as Prisma.InputJsonValue),
  };

  await prisma.game.upsert({
    where: { uid: record.uid },
    create: { uid: record.uid, ...data },
    update: data,
  });
}

/** Is a finished game with this uid stored? (Used to avoid reusing a uid.) */
export async function finishedGameExistsForEngine(uid: string): Promise<boolean> {
  return (await prisma.game.count({ where: { uid } })) > 0;
}
