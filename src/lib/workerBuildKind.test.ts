import { describe, expect, it } from 'vitest';
import type { WorkerBuild } from './types';
import { buildKind } from './workerBuildKind';

const build = (
  status: WorkerBuild['status'],
  outcome: WorkerBuild['outcome'],
): WorkerBuild => ({
  id: 'b',
  worker: 'w',
  status,
  outcome,
  branch: 'main',
  commitHash: null,
  commitMessage: null,
  source: 'push',
  repo: null,
  createdAt: '2026-11-10T00:00:00Z',
  startedAt: null,
  stoppedAt: null,
  dashboardUrl: '',
});

describe('buildKind', () => {
  it.each([
    ['queued', null, 'queued'],
    ['initializing', null, 'running'],
    ['running', null, 'running'],
    ['stopped', 'success', 'success'],
    ['stopped', 'fail', 'failure'],
    ['stopped', 'terminated', 'failure'],
    ['stopped', 'cancelled', 'neutral'],
    ['stopped', 'skipped', 'neutral'],
    ['stopped', null, 'neutral'],
    // 知らない status は実行中扱い
    ['something_new', null, 'running'],
  ] as const)('%s / %s → %s', (status, outcome, kind) => {
    expect(buildKind(build(status, outcome))).toBe(kind);
  });
});
