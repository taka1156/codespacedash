import { describe, expect, it, vi } from 'vitest';
import { fmtAgo, fmtNum, UNKNOWN } from './format';

describe('fmtNum', () => {
  it.each([
    [0, '0'],
    [0.034, '0.03'],
    // 1・10 ちょうどで表し方が変わる
    [0.99, '0.99'],
    [1, '1.0'],
    [9.94, '9.9'],
    [10, '10'],
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
  const NOW = new Date('2026-11-27T05:00:00Z');
  const ago = (min: number) =>
    new Date(NOW.getTime() - min * 60_000).toISOString();

  it.each([
    [0.99, 'たった今'],
    [1, '1分前'],
    [59.99, '59分前'],
    [60, '1時間前'],
    [1439.99, '23時間前'],
    [1440, '1日前'],
  ])('%s 分前は %s（単位が変わる境目）', (min, text) => {
    vi.useFakeTimers({ now: NOW, toFake: ['Date'] });
    expect(fmtAgo(ago(min))).toBe(text);
  });

  it('日時として読めなければ NaN と出さない', () => {
    expect(fmtAgo('not-a-date')).toBe(UNKNOWN);
  });
});
