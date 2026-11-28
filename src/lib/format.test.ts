import { describe, expect, it } from 'vitest';
import { fmtAgo, fmtNum, UNKNOWN } from './format';

describe('fmtNum', () => {
  it.each([
    [0, '0'],
    [0.034, '0.03'],
    [2.54, '2.5'],
    [1234567, '1,234,567'],
    // 読めない値は NaN と出さない
    [Number.NaN, UNKNOWN],
    [Number.POSITIVE_INFINITY, UNKNOWN],
  ])('%s → %s', (n, s) => {
    expect(fmtNum(n)).toBe(s);
  });
});

describe('fmtAgo', () => {
  it('日時として読めなければ NaN と出さない', () => {
    expect(fmtAgo('not-a-date')).toBe(UNKNOWN);
  });
});
