import { describe, expect, it } from 'vitest';
import { numVar } from './env';

describe('numVar', () => {
  it.each([
    ['30', 30],
    ['1.5', 1.5],
    [undefined, 60],
    ['', 60],
    ['abc', 60],
    ['0', 60],
    ['-5', 60],
    ['Infinity', 60],
  ])('%s → %s', (v, n) => {
    expect(numVar(v, 60)).toBe(n);
  });
});
