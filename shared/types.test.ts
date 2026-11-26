import { describe, expect, it } from 'vitest';
import { okData } from './types';

describe('okData', () => {
  it('ok ならデータ、それ以外と undefined は null', () => {
    expect(okData({ status: 'ok', data: 1 })).toBe(1);
    expect(okData({ status: 'error', message: 'x' })).toBeNull();
    expect(okData(undefined)).toBeNull();
  });
});
