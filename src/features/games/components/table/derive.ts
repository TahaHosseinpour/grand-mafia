import type { GameInfo } from '../wire';

/**
 * What the table means for the person looking at it, derived from a game
 * update: which seat is theirs and what the game is waiting on them for.
 * Pure — the screen and the tests both use it.
 */

export type Policy = 'liberal' | 'fascist';
type Card = NonNullable<GameInfo['cardFlingerState']>[number];

export type MyAction =
  | { kind: 'nominate'; candidates: number[] }
  | { kind: 'vote'; chosen: boolean | null }
  | { kind: 'discard'; cards: Policy[] }
  | { kind: 'enact'; cards: Policy[]; vetoUnlocked: boolean }
  | { kind: 'chancellorVeto' }
  | { kind: 'presidentVeto' }
  | { kind: 'burn'; card: Policy | null }
  | { kind: 'peek' }
  | { kind: 'peekDrop' }
  | { kind: 'investigate'; candidates: number[] }
  | { kind: 'reveal'; candidates: number[] }
  | { kind: 'specialElection'; candidates: number[] }
  | { kind: 'execute'; candidates: number[] }
  | { kind: 'assassinate'; candidates: number[] };

export const policyOf = (card: Card | undefined): Policy | null => {
  const back = card?.cardStatus.cardBack;
  if (back === 'liberalp') return 'liberal';
  if (back === 'fascistp') return 'fascist';
  return null;
};

export function mySeat(game: GameInfo, userName: string | undefined): number {
  return userName ? game.publicPlayersState.findIndex((player) => player.userName === userName) : -1;
}

/** What the game is waiting on this player to do right now, if anything. */
export function myAction(game: GameInfo, userName: string | undefined): MyAction | null {
  const seat = mySeat(game, userName);
  if (seat < 0 || !game.gameState.isTracksFlipped || game.gameState.isCompleted) return null;

  const { phase, clickActionInfo } = game.gameState;
  const cards = game.cardFlingerState ?? [];
  const activeCards = cards.length > 0 && cards[0]?.action === 'active';
  const clicker = clickActionInfo?.[0] === userName ? (clickActionInfo?.[1] ?? []) : null;
  const ballots = cards.length === 2 && cards[0].cardStatus.cardFront === 'ballot';
  const chosenBallot = (): boolean | null => {
    const selected = cards.findIndex((card) => card.notificationStatus === 'selected');
    return selected === -1 ? null : selected === 0;
  };

  switch (phase) {
    case 'selectingChancellor':
      return clicker ? { kind: 'nominate', candidates: clicker } : null;
    case 'voting':
      // The ballots are dealt face down and turned over when the vote opens.
      return ballots && activeCards && cards[0].cardStatus.isFlipped ? { kind: 'vote', chosen: chosenBallot() } : null;
    case 'presidentSelectingPolicy':
      return cards.length === 3 && activeCards ? { kind: 'discard', cards: cards.map((card) => policyOf(card) ?? 'liberal') } : null;
    case 'chancellorSelectingPolicy':
      return cards.length === 2 && activeCards && !ballots
        ? { kind: 'enact', cards: cards.map((card) => policyOf(card) ?? 'liberal'), vetoUnlocked: Boolean(game.gameState.isVetoEnabled) }
        : null;
    case 'chancellorVoteOnVeto':
      return ballots && activeCards ? { kind: 'chancellorVeto' } : null;
    case 'presidentVoteOnVeto':
      return ballots && activeCards ? { kind: 'presidentVeto' } : null;
    case 'presidentVoteOnBurn':
      return ballots && activeCards ? { kind: 'burn', card: null } : null;
    case 'selectPartyMembershipInvestigate':
      return clicker ? { kind: 'investigate', candidates: clicker } : null;
    case 'selectPartyMembershipInvestigateReverse':
      return clicker ? { kind: 'reveal', candidates: clicker } : null;
    case 'specialElection':
      return clicker ? { kind: 'specialElection', candidates: clicker } : null;
    case 'execution':
      return clicker ? { kind: 'execute', candidates: clicker } : null;
    case 'assassination':
      return clicker ? { kind: 'assassinate', candidates: clicker } : null;
    default:
      break;
  }

  // Powers that wait on a click rather than a phase: look at the top of the deck.
  const own = game.playersState?.[seat];
  if (own?.policyNotification && game.publicPlayersState[seat]?.governmentStatus === 'isPresident') {
    const power = game.customGameSettings.powers?.[game.trackState.fascistPolicyCount - 1];
    return power === 'peekdrop' ? { kind: 'peekDrop' } : { kind: 'peek' };
  }
  return null;
}

/** The policies the president is looking at during a peek (top three, or one). */
export function peekedPolicies(game: GameInfo, userName: string | undefined): Policy[] | null {
  const seat = mySeat(game, userName);
  if (seat < 0) return null;
  const { phase } = game.gameState;
  const cards = game.cardFlingerState ?? [];
  if (phase === 'presidentSelectingPolicy' || phase === 'chancellorSelectingPolicy') return null;
  if (!(cards.length === 3 || cards.length === 1) || cards[0].cardStatus.cardFront !== 'policy') return null;
  const policies = cards.map(policyOf);
  return policies.every((policy): policy is Policy => policy !== null) ? policies : null;
}

/** Party membership this player has learned: seat → team. */
export function knownMemberships(game: GameInfo, userName: string | undefined): Map<number, Policy> {
  const result = new Map<number, Policy>();
  const seat = mySeat(game, userName);
  if (seat < 0 || !game.playersState) return result;
  game.playersState.forEach((state, index) => {
    const back = state.cardStatus?.cardBack as { cardName?: string } | undefined;
    if (back?.cardName === 'membership-liberal') result.set(index, 'liberal');
    if (back?.cardName === 'membership-fascist') result.set(index, 'fascist');
  });
  return result;
}

const ROLE_NAMES = new Set(['liberal', 'fascist', 'hitler', 'merlin', 'percival', 'morgana', 'monarchist']);

/** This player's own secret role, once dealt. */
export function myRole(game: GameInfo, userName: string | undefined): string | null {
  const seat = mySeat(game, userName);
  if (seat < 0 || !game.playersState?.[seat]) return null;
  const back = game.playersState[seat].cardStatus?.cardBack as { cardName?: string } | undefined;
  if (back?.cardName && ROLE_NAMES.has(back.cardName)) return back.cardName;
  const name = game.playersState[seat].nameStatus;
  return name && ROLE_NAMES.has(name) ? name : null;
}

/**
 * What each seat is known as to this viewer: their own role, fellow fascists
 * and Hitler as the rules allow, Merlin candidates, and every role once the
 * game is over.
 */
export function seatRoles(game: GameInfo): (string | null)[] {
  return game.publicPlayersState.map((player, index) => {
    const own = game.playersState?.[index]?.nameStatus;
    if (own && own !== 'merlin_candidate') return own;
    const back = player.cardStatus?.cardBack as { cardName?: string } | undefined;
    if (player.cardStatus?.cardFront === 'secretrole' && back?.cardName && ROLE_NAMES.has(back.cardName)) return back.cardName;
    return own === 'merlin_candidate' ? 'merlin_candidate' : null;
  });
}

/** How each seat voted, once the ballots are turned over. */
export function revealedVotes(game: GameInfo): (boolean | null)[] {
  return game.publicPlayersState.map((player) => {
    if (player.cardStatus?.cardFront !== 'ballot' || !player.cardStatus.isFlipped) return null;
    const back = player.cardStatus.cardBack as { cardName?: string } | undefined;
    return back?.cardName === 'ja' ? true : back?.cardName === 'nein' ? false : null;
  });
}
