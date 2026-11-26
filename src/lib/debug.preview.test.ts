import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Settings } from '@/hooks/useSettings';
import { okData } from './types';

// 静的プレビュー（GitHub Pages）ではサーバーがないので、サンプルデータを作って表示する
beforeEach(() => {
  vi.stubEnv('MODE', 'pages');
  vi.resetModules();
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

const load = async () => {
  const { applyDebug } = await import('./debug');
  const { EMPTY_DEBUG } = await import('@/hooks/useSettings');
  const settings: Settings = {
    githubPlan: 'auto',
    copilotPlan: 'pro',
    workersPlan: 'auto',
    serviceTab: 'github',
    debug: { ...EMPTY_DEBUG, enabled: true },
  };
  return { applyDebug, settings };
};

describe('applyDebug（静的プレビュー）', () => {
  it('データがなければサンプルデータを作る', async () => {
    const { applyDebug, settings } = await load();
    const out = applyDebug(null, settings);
    expect(out?.user.login).toBe('preview-user');

    const cs = okData(out?.github.codespaces) ?? [];
    expect(cs.map((c) => c.state)).toEqual([
      'Available',
      'Available',
      'Shutdown',
    ]);
    expect(cs[0].display_name).toBe('web-app');

    const runs = okData(out?.github.runs) ?? [];
    expect(runs).toHaveLength(5);
    expect(runs[0].updatedAt <= new Date().toISOString()).toBe(true);

    const b = okData(out?.cloudflare.builds);
    expect(b?.builds).toHaveLength(6);
    // 実行中のビルドは終了時刻がない
    expect(b?.builds[0].stoppedAt).toBeNull();
    expect(b?.builds[1].stoppedAt).not.toBeNull();
    // 5件目だけ PR のビルド
    expect(b?.builds.map((x) => x.source)).toEqual([
      'push',
      'push',
      'push',
      'push',
      'pull_request',
      'push',
    ]);
    expect(b?.builds[4].branch).toBe('docs/typo');

    const u = okData(out?.cloudflare.usage);
    expect(okData(u?.daily.kvLists)).toBe(620);
    expect(u?.dayStart.endsWith('T00:00:00.000Z')).toBe(true);
  });
});
