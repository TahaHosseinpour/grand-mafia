import { describe, expect, it } from 'vitest';
import { LineGuess } from './line-guess';

describe('LineGuess', () => {
  it('parses seats and the Hitler marker, sorted', () => {
    const guess = LineGuess.parse('31h')!;
    expect(guess.regs).toEqual([1, 3]);
    expect(guess.hit).toBe(1);
    expect(guess.toString()).toBe('1h3');
  });

  it('reads 0 as seat 10', () => {
    const guess = LineGuess.parse('20')!;
    expect(guess.regs).toEqual([2, 10]);
    expect(guess.toString()).toBe('20');
  });

  it('rejects a repeated seat and two Hitlers', () => {
    expect(LineGuess.parse('11')).toBeNull();
    expect(LineGuess.parse('1h2h')).toBeNull();
    expect(LineGuess.parse('abc')).toBeNull();
  });

  it('compares a guess with the truth', () => {
    const truth = LineGuess.parse('12h')!;
    expect(LineGuess.parse('13h')!.difference(truth)).toEqual([1, false]);
    expect(LineGuess.parse('12h')!.difference(truth)).toEqual([2, true]);
    expect(truth.equals(LineGuess.parse('2h1')!)).toBe(true);
  });
});
