import { describe, expect, it } from 'vitest';
import type { WorkerBuild } from '../../shared/types';
import {
  billingPeriod,
  buildMinutes,
  detectPlan,
  usedMinutes,
} from './workersBuilds';

const build = (p: Partial<WorkerBuild>): WorkerBuild => ({
  id: 'b',
  worker: 'w',
  status: 'stopped',
  outcome: 'success',
  branch: 'main',
  commitHash: null,
  commitMessage: null,
  source: 'push',
  repo: null,
  createdAt: '2026-11-10T00:00:00Z',
  startedAt: '2026-11-10T00:00:00Z',
  stoppedAt: '2026-11-10T00:02:30Z',
  dashboardUrl: '',
  ...p,
});

describe('detectPlan', () => {
  it('limits が取れなければ判定しない', () => {
    expect(detectPlan(null)).toBeNull();
  });
  it('リセット日か上限フラグがあれば Free', () => {
    expect(
      detectPlan({ build_minutes_refresh_on: '2026-12-01T00:00:00Z' }),
    ).toBe('free');
    expect(detectPlan({ has_reached_build_minutes_limit: false })).toBe('free');
  });
  it('どちらもなければ有料プラン', () => {
    expect(detectPlan({})).toBe('paid');
  });
});

describe('billingPeriod', () => {
  it('リセット日があればその1か月前から', () => {
    expect(billingPeriod('2026-12-05T03:00:00Z', 'Asia/Tokyo')).toEqual({
      start: '2026-11-05T03:00:00.000Z',
      end: '2026-12-05T03:00:00.000Z',
    });
  });
  it('なければタイムゾーン基準の今月（JST の 11/1 0:00 = UTC 10/31 15:00）', () => {
    expect(
      billingPeriod(null, 'Asia/Tokyo', new Date('2026-11-26T12:00:00Z')),
    ).toEqual({
      start: '2026-10-31T15:00:00.000Z',
      end: '2026-11-30T15:00:00.000Z',
    });
  });
  it('月初の UTC では前月でも、JST では今月として扱う', () => {
    // UTC 11/30 16:00 = JST 12/1 1:00
    expect(
      billingPeriod(null, 'Asia/Tokyo', new Date('2026-11-30T16:00:00Z')).start,
    ).toBe('2026-11-30T15:00:00.000Z');
  });
});

describe('buildMinutes', () => {
  it('1分単位で切り上げる', () => {
    expect(buildMinutes(build({}))).toBe(3);
  });
  it('待機中は数えない', () => {
    expect(buildMinutes(build({ status: 'queued', stoppedAt: null }))).toBe(0);
  });
  it('ビルド中は今までの時間を数える', () => {
    expect(
      buildMinutes(
        build({ status: 'running', stoppedAt: null }),
        new Date('2026-11-10T00:04:00Z'),
      ),
    ).toBe(4);
  });
  it('開始時刻がなければ作成時刻から数える', () => {
    expect(buildMinutes(build({ startedAt: null }))).toBe(3);
  });
});

describe('usedMinutes', () => {
  const period = {
    start: '2026-11-01T00:00:00Z',
    end: '2026-12-01T00:00:00Z',
  };
  it('期間内のビルドだけ合計する', () => {
    const builds = [
      build({}),
      build({
        createdAt: '2026-11-20T00:00:00Z',
        startedAt: '2026-11-20T00:00:00Z',
        stoppedAt: '2026-11-20T00:10:00Z',
      }),
      build({
        createdAt: '2026-10-31T23:00:00Z',
        startedAt: '2026-10-31T23:00:00Z',
        stoppedAt: '2026-10-31T23:30:00Z',
      }),
    ];
    expect(usedMinutes(builds, period)).toBe(13);
  });
});

describe('billingPeriod（不正なリセット日）', () => {
  it('日付として読めなければタイムゾーン基準の今月', () => {
    expect(
      billingPeriod('not-a-date', 'UTC', new Date('2026-11-15T00:00:00Z')),
    ).toEqual({
      start: '2026-11-01T00:00:00.000Z',
      end: '2026-12-01T00:00:00.000Z',
    });
  });
});

describe('buildMinutes（時刻の逆転）', () => {
  it('終了が開始より前なら 0', () => {
    expect(
      buildMinutes(
        build({
          startedAt: '2026-11-10T00:05:00Z',
          stoppedAt: '2026-11-10T00:00:00Z',
        }),
      ),
    ).toBe(0);
  });
});
