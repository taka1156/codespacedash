import { describe, expect, it } from 'vitest';
import { fmtNum } from './format';

describe('fmtNum', () => {
  it.each([
    [0, '0'],
    [0.034, '0.03'],
    [2.54, '2.5'],
    [1234567, '1,234,567'],
  ])('%s → %s', (n, s) => {
    expect(fmtNum(n)).toBe(s);
  });
});
