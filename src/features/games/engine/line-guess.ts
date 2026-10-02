/**
 * A line guess by an observer: which seats are fascist, and optionally which
 * one is Hitler ("12h" = seats 1 and 2, seat 2 is Hitler; seat 10 is "0").
 * Ported from legacy `LineGuess`.
 */
export class LineGuess {
  regs: number[];
  hit: number | null;

  constructor(init: { regs: number[]; hit: number | null } = { regs: [], hit: null }) {
    this.regs = init.regs;
    this.hit = init.hit;
  }

  toString(): string {
    return this.regs
      .map((reg) => {
        const shown = reg === 10 ? 0 : reg;
        return reg === this.hit ? `${shown}h` : `${shown}`;
      })
      .join('');
  }

  equals(other: LineGuess): boolean {
    if (this.hit !== other.hit || this.regs.length !== other.regs.length) return false;
    return this.regs.every((reg, i) => reg === other.regs[i]);
  }

  /** The guess, or null when the text is not a valid guess. */
  static parse(guess: string): LineGuess | null {
    const matches = guess.match(/(\dh?)/gi);
    if (!matches) return null;

    const result = new LineGuess();
    for (const match of matches) {
      let seat = Number.parseInt(match[0], 10);
      seat = seat === 0 ? 10 : seat;
      if (result.regs.includes(seat)) return null;

      result.regs.push(seat);
      if (match.length === 2) {
        if (result.hit) return null;
        result.hit = seat;
      }
    }

    result.regs.sort((a, b) => a - b);
    return result;
  }

  /** `[fascists in common, whether Hitler matches]`. */
  difference(other: LineGuess): [number, boolean] {
    const same = this.regs.reduce((count, seat) => count + (other.regs.includes(seat) ? 1 : 0), 0);
    return [same, this.hit === other.hit];
  }
}
