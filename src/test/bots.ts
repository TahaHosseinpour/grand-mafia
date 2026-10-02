import { vi } from 'vitest';
import {
  selectBurnCard,
  selectChancellor,
  selectChancellorPolicy,
  selectChancellorVoteOnVeto,
  selectOnePolicy,
  selectPartyMembershipInvestigate,
  selectPartyMembershipInvestigateReverse,
  selectPlayerToAssassinate,
  selectPlayerToExecute,
  selectPolicies,
  selectPresidentPolicy,
  selectPresidentVoteOnVeto,
  selectSpecialElection,
  selectVoting,
} from '@/features/games/realtime';
import type { Game } from '@/features/games/engine/types';
import type { FakeHub, FakeSocket } from './fake-hub';

/**
 * Players that play by the rules: each time the game is waiting for someone
 * the bot makes a legal choice with the same engine calls the sockets make.
 * Choices come from a seeded generator, so a failing game can be replayed.
 */

/** mulberry32: small, fast, good enough for choosing seats. */
export function seededRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

type Table = { game: Game; hub: FakeHub; rng: () => number };

const pick = <T>(rng: () => number, items: T[]): T => items[Math.floor(rng() * items.length)];

function socketOf(table: Table, userName: string): FakeSocket {
  const socket = table.hub.allSockets().find((candidate) => candidate.username === userName);
  if (!socket) throw new Error(`no socket for ${userName}`);
  return socket;
}

/** Everything a bot did, for assertions and for reading a failed run. */
export type Journal = string[];

/**
 * Looks at the table once and does whatever the game is waiting for.
 * Returns true when it acted.
 */
export function act(table: Table, done: Set<string>, journal: Journal, options: { useVeto: boolean }): boolean {
  const { game, rng } = table;
  const { gameState, private: secret, general } = game;
  const seated = secret.seatedPlayers;
  const stamp = `${general.electionCount}:${gameState.phase}:${gameState.presidentIndex}`;
  const { presidentIndex } = gameState;
  const president = seated[presidentIndex];
  const asPresident = president ? { username: president.userName } : null;
  const alive = seated.map((_, i) => i).filter((i) => !seated[i].isDead);

  const once = (key: string, run: () => void): boolean => {
    if (done.has(key)) return false;
    done.add(key);
    run();
    journal.push(key);
    return true;
  };

  switch (gameState.phase) {
    case 'selectingChancellor': {
      const previous = gameState.previousElectedGovernment;
      const legal = alive.filter(
        (i) => i !== presidentIndex && i !== previous[1] && !(i === previous[0] && game.general.livingPlayerCount > 5)
      );
      if (!asPresident || !legal.length) return false;
      return once(`${stamp}:nominate`, () =>
        selectChancellor(socketOf(table, president.userName), asPresident, game, { chancellorIndex: pick(rng, legal) })
      );
    }

    case 'voting': {
      let acted = false;
      for (const i of alive) {
        const seat = seated[i];
        // The ballots are dealt a moment after the vote opens; before that there is nothing to click.
        if (!seat.voteStatus || seat.voteStatus.hasVoted) continue;
        const yes = rng() < 0.65;
        acted =
          once(`${stamp}:vote:${i}`, () => selectVoting({ username: seat.userName }, game, { vote: yes }, socketOf(table, seat.userName))) || acted;
      }
      return acted;
    }

    case 'presidentSelectingPolicy': {
      if (!asPresident || president.cardFlingerState?.length !== 3) return false;
      return once(`${stamp}:discard`, () =>
        selectPresidentPolicy(asPresident, game, { selection: Math.floor(rng() * 3) }, false, socketOf(table, president.userName))
      );
    }

    case 'chancellorSelectingPolicy': {
      const chancellorIndex = game.publicPlayersState.findIndex((p) => p.governmentStatus === 'isChancellor');
      const chancellor = seated[chancellorIndex];
      if (!chancellor || chancellor.cardFlingerState?.length !== 2) return false;
      // Selection 3 is "enact the second card".
      const selection = rng() < 0.5 ? 0 : 3;
      return once(`${stamp}:enact`, () =>
        selectChancellorPolicy({ username: chancellor.userName }, game, { selection }, false, socketOf(table, chancellor.userName))
      );
    }

    case 'chancellorVoteOnVeto': {
      const chancellorIndex = game.publicPlayersState.findIndex((p) => p.governmentStatus === 'isChancellor');
      const chancellor = seated[chancellorIndex];
      if (!chancellor || chancellor.cardFlingerState?.length !== 2) return false;
      return once(`${stamp}:veto-ask`, () =>
        selectChancellorVoteOnVeto({ username: chancellor.userName }, game, { vote: options.useVeto && rng() < 0.5 }, socketOf(table, chancellor.userName))
      );
    }

    case 'presidentVoteOnVeto': {
      if (!asPresident) return false;
      return once(`${stamp}:veto-answer`, () =>
        selectPresidentVoteOnVeto(asPresident, game, { vote: rng() < 0.5 }, socketOf(table, president.userName))
      );
    }

    case 'presidentVoteOnBurn': {
      if (!asPresident) return false;
      return once(`${stamp}:burn`, () => selectBurnCard(asPresident, game, { vote: rng() < 0.5 }, socketOf(table, president.userName)));
    }

    case 'selectPartyMembershipInvestigate':
    case 'selectPartyMembershipInvestigateReverse': {
      if (!asPresident) return false;
      const targets = alive.filter((i) => i !== presidentIndex && !seated[i].wasInvestigated);
      if (!targets.length) return false;
      const reverse = gameState.phase === 'selectPartyMembershipInvestigateReverse';
      const choose = reverse ? selectPartyMembershipInvestigateReverse : selectPartyMembershipInvestigate;
      return once(`${stamp}:investigate`, () =>
        choose(asPresident, game, { playerIndex: pick(rng, targets) }, socketOf(table, president.userName))
      );
    }

    case 'specialElection': {
      if (!asPresident) return false;
      const targets = alive.filter((i) => i !== presidentIndex);
      return once(`${stamp}:special`, () =>
        selectSpecialElection(asPresident, game, { playerIndex: pick(rng, targets) }, socketOf(table, president.userName))
      );
    }

    case 'execution': {
      if (!asPresident) return false;
      // A plain fascist may not shoot Hitler (unless the game allows it); the engine refuses that click.
      const cannotShootHitler = !game.customGameSettings.fasCanShootHit && president.role.cardName === 'fascist';
      const targets = alive.filter((i) => i !== presidentIndex && !(cannotShootHitler && seated[i].role.cardName === 'hitler'));
      return once(`${stamp}:execute`, () =>
        selectPlayerToExecute(asPresident, game, { playerIndex: pick(rng, targets) }, socketOf(table, president.userName))
      );
    }

    case 'assassination': {
      // Avalon mode: Hitler guesses who Merlin is.
      const assassin = seated.find((seat) => seat.role.cardName === 'hitler');
      const targets = seated.map((_, i) => i).filter((i) => seated[i].role.team === 'liberal');
      if (!assassin || !targets.length) return false;
      return once(`${stamp}:assassinate`, () =>
        selectPlayerToAssassinate({ username: assassin.userName }, game, { playerIndex: pick(rng, targets) }, socketOf(table, assassin.userName))
      );
    }

    default:
      break;
  }

  // Powers that wait on a button rather than a phase: the president peeks at the deck.
  if (asPresident && president.playersState?.[presidentIndex]?.policyNotification) {
    if (secret.lock.policyPeek && !secret.lock.selectPolicies) {
      return once(`${stamp}:peek`, () => selectPolicies(asPresident, game));
    }
    if (secret.lock.policyPeekAndDrop && !secret.lock.selectOnePolicy) {
      return once(`${stamp}:peekdrop`, () => selectOnePolicy(asPresident, game, socketOf(table, president.userName)));
    }
  }

  return false;
}

export type PlayResult = {
  completed: boolean;
  /** Simulated milliseconds the game took. */
  elapsedMs: number;
  journal: Journal;
};

/**
 * Plays a started game to its end on fake timers: act, let time pass, repeat.
 * Gives up (completed: false) when the game has not ended within `limitMs`
 * of simulated time — a stalled game is a bug, not a slow one.
 */
export function playToTheEnd(
  table: Table,
  options: { useVeto?: boolean; stepMs?: number; limitMs?: number } = {}
): PlayResult {
  const { stepMs = 250, limitMs = 6 * 60 * 60 * 1000, useVeto = true } = options;
  const done = new Set<string>();
  const journal: Journal = [];
  let elapsedMs = 0;

  while (!table.game.gameState.isCompleted && elapsedMs < limitMs) {
    act(table, done, journal, { useVeto });
    vi.advanceTimersByTime(stepMs);
    elapsedMs += stepMs;
  }

  return { completed: Boolean(table.game.gameState.isCompleted), elapsedMs, journal };
}
