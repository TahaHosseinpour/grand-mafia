import { afterEach, beforeEach, vi } from 'vitest';
import { world } from './world';

/**
 * Runs before every test file. The data layers are replaced by the in-memory
 * `world`; everything above them (the engine, the realtime handlers, the
 * validation) is the real code.
 */

vi.mock('@/features/users/dal', () => {
  const find = (username: string) => world.accounts.get(username) ?? null;
  return {
    usernameKey: (username: string) => username.toLowerCase(),
    loadPresenceForRealtime: async (username: string) => {
      const account = find(username);
      return account ? structuredClone(account) : null;
    },
    getEloForGameStart: async (usernames: string[]) =>
      Object.fromEntries(
        usernames.flatMap((name) => {
          const account = find(name);
          return account ? [[name, { overall: account.eloOverall, season: account.eloSeason }]] : [];
        })
      ),
    saveGameSettingsForRealtime: async (username: string, settings: Record<string, unknown>) => {
      world.account(username).gameSettings = structuredClone(settings);
    },
    saveBioForRealtime: async (username: string, bio: string) => {
      world.account(username).bio = bio;
    },
    saveThemeForRealtime: async () => undefined,
    acceptTermsForRealtime: async (username: string, version: string) => {
      world.account(username).touLastAgreed = version;
    },
    dismissSignupModalForRealtime: async (username: string) => {
      world.account(username).hasNotDismissedSignupModal = false;
    },
    recordVersionSeenForRealtime: async (username: string, version: string) => {
      world.account(username).lastVersionSeen = version;
    },
    findUnacknowledgedWarningForRealtime: async (username: string) => world.warnings.get(username)?.find((w) => !w.acknowledged) ?? null,
    acknowledgeWarningForRealtime: async (username: string) => {
      const warning = world.warnings.get(username)?.find((w) => !w.acknowledged);
      if (warning) warning.acknowledged = true;
    },
    submitFeedbackForRealtime: async (username: string, text: string) => {
      world.feedback.push({ username, text, at: new Date() });
    },
    secondLastFeedbackAtForRealtime: async (username: string) => {
      const mine = world.feedback.filter((entry) => entry.username === username);
      return mine.length >= 2 ? mine[mine.length - 2].at : null;
    },
    findStaffAmongForRealtime: async (usernames: string[]) =>
      usernames.filter((name) => {
        const role = find(name)?.staffRole;
        return role === 'altmod' || role === 'moderator' || role === 'editor' || role === 'admin' || role === 'trialmod';
      }),
    listPlayerNotesForRealtime: async () => [],
  };
});

vi.mock('@/features/moderation/dal', () => ({
  GLOBAL_SWITCHES: {},
  isSwitchOn: async (name: string) => world.switches[name] === true,
  getIpBanStatus: async (ip: string) => world.ipBans.get(ip) ?? null,
  recordSignupEvent: async () => undefined,
  recordNewAccountIpBan: async () => undefined,
  recordEightEight: async () => undefined,
  reportToModerators: (report: never) => {
    world.reports.push(report);
  },
}));

vi.mock('@/features/ranking/dal', () => ({
  applyRankedResultForGameEnd: async (result: Parameters<typeof world.applyRanked>[0]) => {
    world.rankedResults.push(result);
    return world.applyRanked(result);
  },
  applyUnrankedXpForGameEnd: async (players: string[], winners: string[]) => {
    world.unrankedResults.push({ players, winners });
  },
}));

vi.mock('@/features/games/dal', async () => {
  const { engineStore } = await import('@/features/games/engine/store');
  return {
    countOnlinePlayers: () => engineStore().userList.length,
    saveFinishedGameForEngine: async (record: (typeof world.savedGames)[number]) => {
      world.savedGames.push(record);
    },
    finishedGameExistsForEngine: async () => false,
  };
});

beforeEach(() => {
  world.reset();
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});
