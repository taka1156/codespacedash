import { describe, expect, it } from 'vitest';
import { usageErrorDetails, usageValues } from './cloudflareUsage';
import type { CloudflareUsage } from './types';

const ok = (data: number) => ({ status: 'ok' as const, data });

const usage: CloudflareUsage = {
  daily: {
    workersRequests: ok(1),
    workersAiNeurons: { status: 'error', message: 'x' },
    d1RowsRead: ok(3),
    d1RowsWritten: ok(4),
    kvReads: ok(5),
    kvWrites: ok(6),
    kvDeletes: ok(7),
    kvLists: ok(8),
  },
  monthly: {
    r2StorageGb: ok(1.5),
    r2ClassA: ok(2),
    r2ClassB: ok(3),
    d1StorageGb: ok(0.1),
    kvStorageGb: ok(0.02),
  },
  dayStart: '2026-11-27T00:00:00.000Z',
  monthStart: '2026-11-01T00:00:00.000Z',
};

describe('usageValues', () => {
  it('取れていれば日次・月次の項目をそのまま返す（項目ごとのエラーも残す）', () => {
    const d = usageValues({ status: 'ok', data: usage }, 'daily');
    expect(d?.workersRequests).toEqual(ok(1));
    expect(d?.workersAiNeurons.status).toBe('error');
    expect(usageValues({ status: 'ok', data: usage }, 'monthly')).toBe(
      usage.monthly,
    );
  });

  it('全体が未設定なら全項目を未設定にする', () => {
    const state = { status: 'unconfigured' as const, setting: 'TOKEN' };
    const m = usageValues(state, 'monthly');
    expect(Object.keys(m ?? {})).toEqual([
      'r2StorageGb',
      'r2ClassA',
      'r2ClassB',
      'd1StorageGb',
      'kvStorageGb',
    ]);
    expect(Object.values(m ?? {}).every((v) => v === state)).toBe(true);
  });

  it('全体が権限不足なら日次の8項目すべてが権限不足', () => {
    const state = {
      status: 'forbidden' as const,
      permission: 'Account Analytics: Read',
      message: '403',
    };
    const d = usageValues(state, 'daily');
    expect(Object.values(d ?? {})).toHaveLength(8);
    expect(d?.kvLists).toBe(state);
    expect(d?.kvWrites).toBe(state);
  });

  it('データがまだなければ undefined', () => {
    expect(usageValues(undefined, 'daily')).toBeUndefined();
  });
});

describe('usageErrorDetails', () => {
  const items = [
    { key: 'a', label: 'A' },
    { key: 'b', label: 'B' },
    { key: 'c', label: 'C' },
  ];
  const forbidden = {
    status: 'forbidden' as const,
    permission: 'Account Analytics: Read',
    message: 'not authorized',
  };

  it('全部取れていれば null', () => {
    expect(usageErrorDetails(items, { a: ok(1), b: ok(2) })).toBeNull();
    expect(usageErrorDetails(items, undefined)).toBeNull();
  });

  it('同じ理由の失敗は1行にまとめ、権限名は重複させない', () => {
    expect(
      usageErrorDetails(items, { a: forbidden, b: forbidden, c: forbidden }),
    ).toEqual({
      permissions: ['Account Analytics: Read'],
      lines: [{ key: 'all', label: null, text: 'not authorized' }],
    });
  });

  it('失敗が1件だけならラベルを付けて出す', () => {
    expect(usageErrorDetails(items, { a: ok(1), b: forbidden })).toEqual({
      permissions: ['Account Analytics: Read'],
      lines: [{ key: 'b', label: 'B', text: 'not authorized' }],
    });
  });

  it('理由が違えば項目ごとに出す（未設定は対象外）', () => {
    expect(
      usageErrorDetails(items, {
        a: { status: 'error', message: 'unknown field "x"' },
        b: ok(1),
        c: forbidden,
      }),
    ).toEqual({
      permissions: ['Account Analytics: Read'],
      lines: [
        { key: 'a', label: 'A', text: 'unknown field "x"' },
        { key: 'c', label: 'C', text: 'not authorized' },
      ],
    });
    expect(
      usageErrorDetails(items, {
        a: { status: 'unconfigured', setting: 'TOKEN' },
      }),
    ).toBeNull();
  });
});
