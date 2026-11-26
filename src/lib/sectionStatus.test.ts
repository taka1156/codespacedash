import { describe, expect, it } from 'vitest';
import { statusText } from './sectionStatus';

describe('statusText', () => {
  it('未設定', () => {
    expect(statusText({ status: 'unconfigured', setting: 'X' })).toBe('未設定');
  });

  it('権限不足は足りない権限名を添える', () => {
    expect(
      statusText({
        status: 'forbidden',
        permission: 'Plan: Read',
        message: 'GitHub API 403',
      }),
    ).toBe('権限不足（Plan: Read）');
  });

  it('その他のエラーは取得失敗', () => {
    expect(statusText({ status: 'error', message: 'boom' })).toBe('取得失敗');
  });
});
