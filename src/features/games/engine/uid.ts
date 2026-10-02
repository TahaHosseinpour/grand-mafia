import { engineStore } from './store';
import { sample } from './shuffle';

/**
 * A game's id is three words ("BigHappyFox"): short enough to share in chat
 * and unique among the games alive right now. It is also the Socket.IO room
 * name and the `/game#/table/<uid>` link, so it stays Latin.
 */
const WORDS = [
  'Big', 'Calm', 'Dark', 'Eager', 'Fast', 'Grand', 'Happy', 'Icy', 'Jolly', 'Kind', 'Lucky', 'Merry', 'Noble', 'Odd', 'Proud',
  'Quick', 'Red', 'Shy', 'Tiny', 'Wild', 'Brave', 'Clever', 'Gentle', 'Sunny', 'Quiet', 'Swift', 'Bold', 'Fuzzy', 'Silver', 'Golden',
] as const;

const ANIMALS = [
  'Fox', 'Wolf', 'Bear', 'Lion', 'Tiger', 'Deer', 'Hare', 'Crow', 'Eagle', 'Owl', 'Swan', 'Stork', 'Dolphin', 'Whale', 'Shark',
  'Crab', 'Turtle', 'Frog', 'Snake', 'Horse', 'Camel', 'Falcon', 'Otter', 'Badger', 'Lynx', 'Panda', 'Koala', 'Seal', 'Moose', 'Heron',
] as const;

export function generateGameUid(): string {
  const games = engineStore().games;
  for (let attempt = 0; attempt < 50; attempt++) {
    const uid = `${sample(WORDS)}${sample(WORDS)}${sample(ANIMALS)}`;
    if (!games.has(uid)) return uid;
  }
  // Practically unreachable (27 000 combinations): fall back to a numbered id.
  return `Game${Date.now()}`;
}
