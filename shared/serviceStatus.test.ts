import { describe, expect, it } from 'vitest';
import {
  isSevere,
  issueLabel,
  issuesFor,
  STATUS_LABEL,
  watchedComponents,
} from './serviceStatus';
import type { ServiceIssue } from './types';

const issue = (component: string, status: ServiceIssue['status']) => ({
  component,
  status,
  incidents: [],
});

describe('watchedComponents', () => {
  it('パネルで使うコンポーネント名の一覧', () => {
    expect(watchedComponents('github')).toEqual([
      'API Requests',
      'Codespaces',
      'Actions',
      'Copilot',
      'Pull Requests',
    ]);
    expect(watchedComponents('cloudflare')).toEqual([
      'API',
      'Workers Builds',
      'Workers',
      'Workers KV',
      'Analytics',
    ]);
  });
});

describe('表示用の文言', () => {
  it('状態名は日本語、コンポーネント名はそのまま', () => {
    expect(issueLabel(issue('Actions', 'degraded_performance'))).toBe(
      '性能低下：Actions',
    );
    expect(Object.values(STATUS_LABEL)).toEqual([
      '性能低下',
      '一部障害',
      '全面障害',
      'メンテナンス中',
    ]);
  });

  it('一部・全面障害だけを赤にする', () => {
    expect(
      (
        [
          'degraded_performance',
          'partial_outage',
          'major_outage',
          'under_maintenance',
        ] as const
      ).filter(isSevere),
    ).toEqual(['partial_outage', 'major_outage']);
  });
});

describe('issuesFor', () => {
  it('指定した名前の障害だけを残す', () => {
    const all = [
      issue('Actions', 'major_outage'),
      issue('Copilot', 'partial_outage'),
    ];
    expect(issuesFor(all, ['Copilot'])).toEqual([all[1]]);
    expect(issuesFor(all, [])).toEqual([]);
  });
});
