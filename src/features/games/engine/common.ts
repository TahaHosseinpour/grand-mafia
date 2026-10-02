import { formatNumber } from '@/lib/datetime';
import { T } from '@/lib/glossary';
import { line, tellAll, typed } from './chat';
import { selectChancellor } from './election-util';
import { sendGameList } from './lists';
import { range, shuffle } from './shuffle';
import { timedModeMs } from './timing';
import { sendInProgressGameUpdate } from './updates';
import type { ActiveGameSettings, Game } from './types';

/** `customGameSettings` once the game has begun: every standard value is filled in. */
export const settingsOf = (game: Game) => game.customGameSettings as ActiveGameSettings;

/**
 * Shuffles the policy deck (and, at the start, lays out the policies a
 * custom game begins with on the tracks).
 */
export function shufflePolicies(game: Game | undefined, isStart = false): void {
  if (!game) return;
  const settings = settingsOf(game);

  if (isStart) {
    game.trackState.enactedPolicies = [];
    if (settings.trackState.lib > 0) {
      game.trackState.liberalPolicyCount = settings.trackState.lib;
      for (const num of range(0, settings.trackState.lib)) {
        game.trackState.enactedPolicies.push({ cardBack: 'liberal', isFlipped: true, position: `liberal${num + 1}` });
      }
    }
    if (settings.trackState.fas > 0) {
      game.trackState.fascistPolicyCount = settings.trackState.fas;
      for (const num of range(0, settings.trackState.fas)) {
        game.trackState.enactedPolicies.push({ cardBack: 'fascist', isFlipped: true, position: `fascist${num + 1}` });
      }
    }
  }

  const libCount = settings.deckState.lib - game.trackState.liberalPolicyCount;
  const fasCount = settings.deckState.fas - game.trackState.fascistPolicyCount;
  game.private.policies = shuffle([
    ...range(0, libCount).map(() => 'liberal' as const),
    ...range(0, fasCount).map(() => 'fascist' as const),
  ]);

  game.gameState.undrawnPolicyCount = game.private.policies.length;

  if (!game.general.disableGamechat) {
    tellAll(
      game,
      line(
        'دسته‌ی قوانین بُر خورد: ',
        typed('liberal', `${formatNumber(libCount)} لیبرال`),
        ' و ',
        typed('fascist', `${formatNumber(fasCount)} فاشیست`),
        '.'
      )
    );
  }

  game.private.hiddenInfoChat.push(
    line(
      'دسته‌ی قوانین بُر خورد: ',
      ...game.private.policies.map((policy) => typed(policy, policy === 'liberal' ? 'B' : 'R'))
    )
  );
}

/** The next living seat after `index`, wrapping around. */
function nextLivingSeat(game: Game, index: number): number {
  const next = index + 1 === game.general.playerCount ? 0 : index + 1;
  return game.publicPlayersState[next].isDead ? nextLivingSeat(game, next) : next;
}

/**
 * Starts a round: moves the presidency on (or to the special-election
 * president), marks who may be nominated, and arms the timer in timed games.
 * @param specialElectionPresidentIndex seat chosen by a special election
 */
export function startElection(game: Game, specialElectionPresidentIndex?: number): void {
  const { experiencedMode } = game.general;
  const settings = settingsOf(game);

  if (game.trackState.fascistPolicyCount >= settings.vetoZone) {
    game.gameState.isVetoEnabled = true;
  }

  if (game.gameState.undrawnPolicyCount < 3) {
    shufflePolicies(game);
  }

  game.gameState.presidentIndex = (() => {
    const { presidentIndex, specialElectionFormerPresidentIndex } = game.gameState;

    if (Number.isInteger(specialElectionPresidentIndex)) {
      return specialElectionPresidentIndex as number;
    }
    if (Number.isInteger(specialElectionFormerPresidentIndex)) {
      game.gameState.specialElectionFormerPresidentIndex = null;
      return nextLivingSeat(game, specialElectionFormerPresidentIndex as number);
    }
    return nextLivingSeat(game, presidentIndex);
  })();

  game.private.summary.nextTurn().updateLog({
    presidentId: game.gameState.presidentIndex,
    deckState: [...game.private.policies],
  });

  const { seatedPlayers } = game.private;
  const { presidentIndex, previousElectedGovernment } = game.gameState;
  const pendingPresidentPlayer = seatedPlayers[presidentIndex];

  game.general.electionCount++;
  sendGameList();
  game.general.status = `انتخابات شماره‌ی ${formatNumber(game.general.electionCount)}: ${T.president} باید ${T.chancellor} را انتخاب کند.`;
  if (!experiencedMode && !game.general.disableGamechat) {
    pendingPresidentPlayer.gameChats.push(line(`شما ${T.president} هستید و باید یک ${T.chancellor} انتخاب کنید.`));
  }

  // Who may be nominated: not the president, not dead, and not term-limited.
  // With more than five players left both last-elected members are limited,
  // with five or fewer only the last chancellor.
  const eligible = (index: number): boolean =>
    !seatedPlayers[index].isDead &&
    index !== presidentIndex &&
    (game.general.livingPlayerCount > 5 ? !previousElectedGovernment.includes(index) : previousElectedGovernment[1] !== index);

  pendingPresidentPlayer.playersState.forEach((state, index) => {
    if (seatedPlayers[index] && eligible(index)) state.notificationStatus = 'notification';
  });

  for (const player of game.publicPlayersState) {
    player.cardStatus.cardDisplayed = false;
    player.governmentStatus = '';
  }

  game.publicPlayersState[presidentIndex].governmentStatus = 'isPendingPresident';
  game.publicPlayersState[presidentIndex].isLoader = true;
  game.gameState.phase = 'selectingChancellor';

  game.gameState.clickActionInfo = [
    pendingPresidentPlayer.userName,
    seatedPlayers.map((_, index) => index).filter(eligible),
  ];

  if (game.general.timedMode) {
    if (game.private.timerId) {
      clearTimeout(game.private.timerId);
      game.private.timerId = null;
    }
    game.gameState.timedModeEnabled = true;
    game.private.timerId = setTimeout(() => {
      if (!game.gameState.timedModeEnabled) return;
      const [, candidates] = game.gameState.clickActionInfo as [string, number[]];
      const chancellorIndex = shuffle(candidates)[0];

      selectChancellor(null, { username: pendingPresidentPlayer.userName }, game, { chancellorIndex });
      game.private.replayGameChats.push(
        line(typed('player', pendingPresidentPlayer.userName), ` توسط زمان‌سنج مجبور شد یک ${T.chancellor} تصادفی انتخاب کند.`)
      );
    }, timedModeMs(game));
  }

  sendInProgressGameUpdate(game);
}
