import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { setPreview } from '@/testing/previewMock';

vi.mock('@/lib/preview', () =>
  import('@/testing/previewMock').then((m) => m.previewModule),
);

const KEY = 'codespacedash:settings';

// 既定値はモジュールの読み込み時に決まるので、テストごとに読み直す
const load = async () => {
  vi.resetModules();
  return import('./useSettings');
};

const setup = async () => {
  const m = await load();
  return { ...m, hook: renderHook(() => m.useSettings()) };
};

const stored = () => JSON.parse(localStorage.getItem(KEY) ?? 'null');

beforeEach(() => {
  localStorage.clear();
});

describe('useSettings', () => {
  it('保存がなければ既定値', async () => {
    const { hook, EMPTY_DEBUG } = await setup();
    expect(hook.result.current.settings).toEqual({
      githubPlan: 'auto',
      copilotPlan: 'pro',
      workersPlan: 'auto',
      serviceTab: 'github',
      debug: EMPTY_DEBUG,
    });
  });

  it('壊れた保存は既定値に戻す', async () => {
    localStorage.setItem(KEY, '{not json');
    const { hook } = await setup();
    expect(hook.result.current.settings.githubPlan).toBe('auto');
  });

  it('保存した値を読む', async () => {
    const saved = {
      githubPlan: 'pro',
      copilotPlan: 'pro_plus',
      workersPlan: 'paid',
      serviceTab: 'cloudflare',
      debug: {
        enabled: true,
        sectionState: 'forbidden',
        githubPlan: 'free',
        copilotPlan: 'free',
        workersPlan: 'free',
        codespacesHours: '1',
        codespacesStorageGb: '2',
        actionsMinutes: '3',
        workersMinutes: '4',
        copilotUsd: '5',
      },
    };
    localStorage.setItem(KEY, JSON.stringify(saved));
    const { hook } = await setup();
    expect(hook.result.current.settings).toEqual(saved);
  });

  it('知らない値・型の違う値は既定値にし、古い項目は捨てる', async () => {
    localStorage.setItem(
      KEY,
      JSON.stringify({
        githubPlan: 'enterprise',
        copilotPlan: 1,
        workersPlan: null,
        serviceTab: 'aws',
        aiProvider: 'claude',
        debug: {
          enabled: 'yes',
          sectionState: 'broken',
          githubPlan: 'x',
          copilotPlan: 'x',
          workersPlan: 'x',
          codespacesHours: 1,
          copilotUsd: null,
        },
      }),
    );
    const { hook, EMPTY_DEBUG } = await setup();
    expect(hook.result.current.settings).toEqual({
      githubPlan: 'auto',
      copilotPlan: 'pro',
      workersPlan: 'auto',
      serviceTab: 'github',
      debug: EMPTY_DEBUG,
    });
  });

  it('debug がない保存も読める', async () => {
    localStorage.setItem(KEY, JSON.stringify({ githubPlan: 'pro' }));
    const { hook, EMPTY_DEBUG } = await setup();
    expect(hook.result.current.settings.githubPlan).toBe('pro');
    expect(hook.result.current.settings.debug).toEqual(EMPTY_DEBUG);
  });

  it('update で変えて保存する', async () => {
    const { hook } = await setup();
    act(() => hook.result.current.update({ serviceTab: 'cloudflare' }));
    expect(hook.result.current.settings.serviceTab).toBe('cloudflare');
    expect(stored().serviceTab).toBe('cloudflare');
  });

  it('updateDebug はデバッグの項目だけ変えて保存する', async () => {
    const { hook } = await setup();
    act(() =>
      hook.result.current.updateDebug({ enabled: true, copilotUsd: '3' }),
    );
    expect(hook.result.current.settings.debug).toMatchObject({
      enabled: true,
      copilotUsd: '3',
      codespacesHours: '',
    });
    expect(stored().debug.copilotUsd).toBe('3');

    act(() => hook.result.current.updateDebug({ enabled: false }));
    expect(hook.result.current.settings.debug.enabled).toBe(false);
  });

  it('保存に失敗しても画面の設定は変える', async () => {
    const { hook } = await setup();
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('QuotaExceededError');
    });
    act(() => hook.result.current.update({ copilotPlan: 'free' }));
    expect(hook.result.current.settings.copilotPlan).toBe('free');
  });

  describe('静的プレビュー', () => {
    beforeEach(() => setPreview(true));

    it('既定でデバッグをオンにしてサンプル値を入れる', async () => {
      const { hook, SAMPLE_DEBUG } = await setup();
      expect(hook.result.current.settings.debug).toMatchObject({
        ...SAMPLE_DEBUG,
        enabled: true,
      });
    });

    it('保存でオフになっていてもデバッグはオン', async () => {
      localStorage.setItem(KEY, JSON.stringify({ debug: { enabled: false } }));
      const { hook } = await setup();
      expect(hook.result.current.settings.debug.enabled).toBe(true);
    });

    it('updateDebug でオフにしようとしてもオンのまま', async () => {
      const { hook } = await setup();
      act(() => hook.result.current.updateDebug({ enabled: false }));
      expect(hook.result.current.settings.debug.enabled).toBe(true);
    });
  });
});
