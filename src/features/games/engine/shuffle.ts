/** Fisher–Yates; the same distribution as lodash `_.shuffle`. */
export function shuffle<T>(items: readonly T[]): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

export const range = (start: number, end: number): number[] =>
  Array.from({ length: Math.max(0, end - start) }, (_, i) => start + i);

export const sample = <T>(items: readonly T[]): T => items[Math.floor(Math.random() * items.length)];
