import 'server-only';
import prisma from '@/server/db';
import { CURRENT_SEASON_NUMBER, DEFAULT_ELO, RAINBOW_XP } from '@/lib/game-constants';
import { computeEloChanges, type EloGameInfo } from './elo';
import type { PlayerRatingAfterGame } from './types';
import type { Prisma } from '@/generated/prisma/client';

/**
 * Ratings after a finished game.
 *
 * Called by the game engine when a game ends (there is no session: the
 * players come from the finished game, never from a request), so the
 * `…ForGameEnd` functions carry no `require*` check — the engine is their
 * only caller and is not reachable from a client.
 */

type GameSettingsJson = { disableSeasonal?: boolean; disableElo?: boolean };

const readSettings = (value: Prisma.JsonValue): GameSettingsJson =>
  value && typeof value === 'object' && !Array.isArray(value) ? (value as GameSettingsJson) : {};

export type RankedGameResult = {
  info: EloGameInfo;
  gameUid: string;
  /** Usernames of the winning team; everyone else lost. */
  winners: string[];
  /** Every seated player. */
  players: string[];
};

/**
 * Applies Elo, XP and win/loss counts for a ranked game and returns each
 * player's numbers after it. Players whose account no longer exists are skipped.
 */
export async function applyRankedResultForGameEnd(result: RankedGameResult): Promise<PlayerRatingAfterGame[]> {
  const keys = result.players.map((name) => name.toLowerCase());

  return prisma.$transaction(async (tx) => {
    const users = await tx.user.findMany({
      where: { usernameKey: { in: keys } },
      include: { seasonStats: { where: { season: CURRENT_SEASON_NUMBER } } },
    });

    const changes = computeEloChanges(
      result.info,
      users.map((user) => ({
        username: user.username,
        eloOverall: user.eloOverall,
        eloSeason: user.eloSeason,
        xpOverall: user.xpOverall,
        xpSeason: user.xpSeason,
        won: result.winners.includes(user.username),
      }))
    );

    const now = new Date();
    const after: PlayerRatingAfterGame[] = [];

    for (const user of users) {
      const change = changes.get(user.username);
      if (!change) continue;
      const won = result.winners.includes(user.username);
      const rainbow = result.info.rainbowGame;
      const season = user.seasonStats[0];

      const eloOverall = (user.eloOverall || DEFAULT_ELO) + change.change;
      const eloSeason = (user.eloSeason || DEFAULT_ELO) + change.changeSeason;
      const xpOverall = user.xpOverall + change.xpChange;
      const xpSeason = user.xpSeason + change.xpChangeSeason;
      const isRainbowOverall = user.isRainbowOverall || xpOverall >= RAINBOW_XP;
      const isRainbowSeason = user.isRainbowSeason || xpSeason >= RAINBOW_XP;

      const wins = user.wins + (won ? 1 : 0);
      const losses = user.losses + (won ? 0 : 1);
      const rainbowWins = user.rainbowWins + (rainbow && won ? 1 : 0);
      const rainbowLosses = user.rainbowLosses + (rainbow && !won ? 1 : 0);
      const seasonCounts = {
        wins: (season?.wins ?? 0) + (won ? 1 : 0),
        losses: (season?.losses ?? 0) + (won ? 0 : 1),
        rainbowWins: (season?.rainbowWins ?? 0) + (rainbow && won ? 1 : 0),
        rainbowLosses: (season?.rainbowLosses ?? 0) + (rainbow && !won ? 1 : 0),
      };

      await tx.user.update({
        where: { id: user.id },
        data: {
          eloOverall,
          eloSeason,
          maxElo: Math.max(user.maxElo, eloOverall),
          xpOverall,
          xpSeason,
          isRainbowOverall,
          isRainbowSeason,
          dateRainbowOverall: isRainbowOverall && !user.isRainbowOverall ? now : user.dateRainbowOverall,
          wins,
          losses,
          rainbowWins,
          rainbowLosses,
          lastCompletedGame: now,
          eloHistory: { create: { date: now, value: eloOverall } },
        },
      });
      await tx.seasonStat.upsert({
        where: { userId_season: { userId: user.id, season: CURRENT_SEASON_NUMBER } },
        create: { userId: user.id, season: CURRENT_SEASON_NUMBER, ...seasonCounts },
        update: seasonCounts,
      });

      const settings = readSettings(user.gameSettings);
      after.push({
        username: user.username,
        eloOverall,
        eloSeason,
        xpOverall,
        xpSeason,
        isRainbowOverall,
        isRainbowSeason,
        wins,
        losses,
        rainbowWins,
        rainbowLosses,
        winsSeason: seasonCounts.wins,
        lossesSeason: seasonCounts.losses,
        rainbowWinsSeason: seasonCounts.rainbowWins,
        rainbowLossesSeason: seasonCounts.rainbowLosses,
        disableSeasonal: Boolean(settings.disableSeasonal),
        disableElo: Boolean(settings.disableElo),
        ...change,
      });
    }
    return after;
  });
}

/**
 * Practice and silent games give XP only: 2 for a win, 1 for a loss.
 */
export async function applyUnrankedXpForGameEnd(players: string[], winners: string[]): Promise<void> {
  const users = await prisma.user.findMany({ where: { usernameKey: { in: players.map((name) => name.toLowerCase()) } } });
  const now = new Date();

  await prisma.$transaction(
    users.map((user) => {
      const gain = winners.includes(user.username) ? 2 : 1;
      const xpOverall = user.xpOverall + gain;
      const xpSeason = user.xpSeason + gain;
      const isRainbowOverall = user.isRainbowOverall || xpOverall >= RAINBOW_XP;
      return prisma.user.update({
        where: { id: user.id },
        data: {
          xpOverall,
          xpSeason,
          isRainbowOverall,
          isRainbowSeason: user.isRainbowSeason || xpSeason >= RAINBOW_XP,
          dateRainbowOverall: isRainbowOverall && !user.isRainbowOverall ? now : user.dateRainbowOverall,
        },
      });
    })
  );
}
