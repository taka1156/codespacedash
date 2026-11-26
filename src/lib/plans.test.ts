import { describe, expect, it } from 'vitest';
import {
  CLOUDFLARE_DAILY_KEYS,
  CLOUDFLARE_MONTHLY_KEYS,
} from '../../shared/types';
import {
  CLOUDFLARE_DAILY_FREE,
  CLOUDFLARE_STORAGE_FREE,
  COPILOT_PLAN_KEYS,
  GITHUB_PLAN_KEYS,
  githubPlanFromApi,
  WORKERS_PLAN_KEYS,
} from './plans';

describe('githubPlanFromApi', () => {
  it.each([
    ['pro', 'pro'],
    ['Pro', 'pro'],
    ['PRO', 'pro'],
    ['free', 'free'],
    ['team', 'free'],
    ['', 'free'],
    [null, 'free'],
    [undefined, 'free'],
  ] as const)('%s → %s', (name, plan) => {
    expect(githubPlanFromApi(name)).toBe(plan);
  });
});

describe('プランのキー一覧', () => {
  it('定義順で並ぶ', () => {
    expect(GITHUB_PLAN_KEYS).toEqual(['free', 'pro']);
    expect(WORKERS_PLAN_KEYS).toEqual(['free', 'paid']);
    expect(COPILOT_PLAN_KEYS).toEqual(['free', 'pro', 'pro_plus']);
  });
});

describe('Cloudflare の無料枠', () => {
  it('日次の枠はサーバーが返すキーと過不足なく対応する', () => {
    expect(CLOUDFLARE_DAILY_FREE.map((f) => f.key).sort()).toEqual(
      [...CLOUDFLARE_DAILY_KEYS].sort(),
    );
  });

  it('月次・総量の枠はサーバーが返すキーと過不足なく対応する', () => {
    expect(CLOUDFLARE_STORAGE_FREE.map((f) => f.key).sort()).toEqual(
      [...CLOUDFLARE_MONTHLY_KEYS].sort(),
    );
  });

  it('枠はすべて正の数', () => {
    for (const f of [...CLOUDFLARE_DAILY_FREE, ...CLOUDFLARE_STORAGE_FREE]) {
      expect(f.free, f.key).toBeGreaterThan(0);
    }
  });
});
