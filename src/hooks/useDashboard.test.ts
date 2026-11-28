import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { api, SessionExpiredError } from '@/lib/api';
import type { DashboardResponse } from '@/lib/types';
import { ago, codespace, dashboard, NOW } from '@/testing/fixtures';
import { setPreview } from '@/testing/previewMock';
import { useDashboard } from './useDashboard';

vi.mock('@/lib/preview', () =>
  import('@/testing/previewMock').then((m) => m.previewModule),
);
vi.mock('@/lib/api', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/api')>()),
  api: { get: vi.fn(), post: vi.fn(), delete: vi.fn() },
}));

const get = vi.mocked(api.get);
const post = vi.mocked(api.post);

/**
 * /dashboard と /workers-builds に、まとめると d になる応答を返す。
 * 呼ばれる順は /dashboard → /workers-builds なので、mock…Once は /dashboard に効く
 */
const serve = (d: DashboardResponse) => {
  get.mockImplementation(async (path: string) => {
    if (path === '/workers-builds') {
      return { builds: d.cloudflare.builds };
    }
    const { builds: _, ...cloudflare } = d.cloudflare;
    return { ...d, cloudflare };
  });
};

/** /dashboard を取りに行った回数 */
const dashboardCalls = () =>
  get.mock.calls.filter(([path]) => path === '/dashboard').length;

/** Promise の解決を待つ */
const flush = () => act(async () => {});

const setHidden = (hidden: boolean) => {
  Object.defineProperty(document, 'hidden', {
    configurable: true,
    value: hidden,
  });
};

const badge = { set: vi.fn(), clear: vi.fn() };

beforeEach(() => {
  vi.useFakeTimers({ now: NOW });
  get.mockReset();
  post.mockReset();
  serve(dashboard());
  setHidden(false);
  badge.set.mockReset().mockResolvedValue(undefined);
  badge.clear.mockReset().mockResolvedValue(undefined);
  Object.assign(navigator, {
    setAppBadge: badge.set,
    clearAppBadge: badge.clear,
  });
  document.title = 'QuotaDash';
});
afterEach(() => {
  const nav = navigator as { setAppBadge?: unknown; clearAppBadge?: unknown };
  delete nav.setAppBadge;
  delete nav.clearAppBadge;
});

describe('useDashboard', () => {
  it('表示時に取得する', async () => {
    const { result } = renderHook(() => useDashboard());
    expect(result.current.loading).toBe(true);
    expect(result.current.lastFetched).toBeNull();
    await flush();
    expect(get).toHaveBeenCalledWith('/dashboard');
    expect(get).toHaveBeenCalledWith('/workers-builds');
    expect(result.current).toMatchObject({
      loading: false,
      error: null,
      sessionExpired: false,
      data: dashboard(),
    });
    expect(result.current.lastFetched).toEqual(NOW);
  });

  it('1分ごとに取り直す（タブが裏にあるときは取らない）', async () => {
    renderHook(() => useDashboard());
    await flush();
    expect(dashboardCalls()).toBe(1);

    await act(() => vi.advanceTimersByTimeAsync(60_000));
    expect(dashboardCalls()).toBe(2);

    setHidden(true);
    await act(() => vi.advanceTimersByTimeAsync(60_000));
    expect(dashboardCalls()).toBe(2);
  });

  it('タブが表に戻ったら取り直す', async () => {
    renderHook(() => useDashboard());
    await flush();

    setHidden(true);
    document.dispatchEvent(new Event('visibilitychange'));
    await flush();
    expect(dashboardCalls()).toBe(1);

    setHidden(false);
    document.dispatchEvent(new Event('visibilitychange'));
    await flush();
    expect(dashboardCalls()).toBe(2);
  });

  it('外したら定期取得とイベントを止める', async () => {
    const { unmount } = renderHook(() => useDashboard());
    await flush();
    unmount();
    await act(() => vi.advanceTimersByTimeAsync(120_000));
    document.dispatchEvent(new Event('visibilitychange'));
    expect(dashboardCalls()).toBe(1);
  });

  it('取得中に呼ばれたら、終わってからもう1回だけ取る', async () => {
    let resolve = (_: DashboardResponse) => {};
    get.mockImplementationOnce(
      () =>
        new Promise((r) => {
          resolve = r;
        }),
    );
    const { result } = renderHook(() => useDashboard());
    await act(async () => {
      result.current.fetchAll();
      result.current.fetchAll();
    });
    expect(dashboardCalls()).toBe(1);

    const second = dashboard({ notifyAfterMin: 5 });
    get.mockResolvedValueOnce(second);
    await act(async () => resolve(dashboard()));
    expect(dashboardCalls()).toBe(2);
    expect(result.current.data).toEqual(second);
    expect(result.current.loading).toBe(false);
  });

  it.each([
    [new Error('GitHub API 502'), 'GitHub API 502'],
    ['raw', 'raw'],
  ])('失敗したらエラーの文言を持つ（%s）', async (err, text) => {
    get.mockRejectedValueOnce(err);
    const { result } = renderHook(() => useDashboard());
    await flush();
    expect(result.current).toMatchObject({
      error: text,
      sessionExpired: false,
      loading: false,
    });

    // 次に成功したらエラーを消す
    await act(() => result.current.fetchAll());
    expect(result.current.error).toBeNull();
  });

  it('セッション切れを区別する', async () => {
    get.mockRejectedValueOnce(new SessionExpiredError());
    const { result } = renderHook(() => useDashboard());
    await flush();
    expect(result.current.sessionExpired).toBe(true);
    expect(result.current.error).toContain('セッションが切れました');
  });

  it.each([
    [new Error('Too many subrequests'), 'Too many subrequests'],
    ['raw', 'raw'],
  ])(
    'Workers Builds だけ取れなければ、そのパネルだけエラーにする（%s）',
    async (err, text) => {
      get.mockImplementation(async (path: string) => {
        if (path === '/workers-builds') {
          throw err;
        }
        const { builds: _, ...cloudflare } = dashboard().cloudflare;
        return { ...dashboard(), cloudflare };
      });
      const { result } = renderHook(() => useDashboard());
      await flush();
      expect(result.current.error).toBeNull();
      expect(result.current.data?.cloudflare.builds).toEqual({
        status: 'error',
        message: text,
      });
      expect(result.current.data?.github).toEqual(dashboard().github);
    },
  );

  it('Workers Builds でセッション切れになったら全体をセッション切れにする', async () => {
    get.mockImplementation(async (path: string) => {
      if (path === '/workers-builds') {
        throw new SessionExpiredError();
      }
      return dashboard();
    });
    const { result } = renderHook(() => useDashboard());
    await flush();
    expect(result.current.sessionExpired).toBe(true);
    expect(result.current.data).toBeNull();
  });

  it('停止したら3秒後に取り直す', async () => {
    const { result } = renderHook(() => useDashboard());
    await flush();
    await act(() => result.current.stopCodespace('a b'));
    expect(post).toHaveBeenCalledWith('/codespaces/a%20b/stop');
    expect(dashboardCalls()).toBe(1);
    await act(() => vi.advanceTimersByTimeAsync(3000));
    expect(dashboardCalls()).toBe(2);
  });

  describe('タイトルとバッジ', () => {
    const withCs = (
      codespaces: DashboardResponse['github']['codespaces'],
      notifyAfterMin = 60,
    ) => dashboard({ github: { codespaces }, notifyAfterMin });

    it('稼働中の台数をタイトルに、つけっぱなしの台数をバッジに出す', async () => {
      serve(
        withCs({
          status: 'ok',
          data: [
            codespace({ id: 1, last_used_at: ago(90) }),
            codespace({ id: 2, last_used_at: ago(60) }),
            codespace({ id: 3, last_used_at: ago(10) }),
            codespace({ id: 4, last_used_at: null }),
            codespace({ id: 5, state: 'Shutdown', last_used_at: ago(999) }),
          ],
        }),
      );
      renderHook(() => useDashboard());
      await flush();
      expect(document.title).toBe('(4) QuotaDash');
      expect(badge.set).toHaveBeenCalledWith(2);
      expect(badge.clear).not.toHaveBeenCalled();
    });

    it('稼働中がなければタイトルの数字とバッジを消す', async () => {
      document.title = '(3) QuotaDash';
      serve(withCs({ status: 'ok', data: [codespace({ state: 'Shutdown' })] }));
      renderHook(() => useDashboard());
      await flush();
      expect(document.title).toBe('QuotaDash');
      expect(badge.clear).toHaveBeenCalled();
    });

    it('一覧が取れなければ何も変えない', async () => {
      document.title = '(3) QuotaDash';
      serve(withCs({ status: 'error', message: 'x' }));
      renderHook(() => useDashboard());
      await flush();
      expect(document.title).toBe('(3) QuotaDash');
      expect(badge.set).not.toHaveBeenCalled();
      expect(badge.clear).not.toHaveBeenCalled();
    });

    it('バッジの失敗は無視し、非対応のブラウザでも落ちない', async () => {
      badge.set.mockRejectedValue(new Error('NotAllowed'));
      serve(
        withCs({ status: 'ok', data: [codespace({ last_used_at: ago(90) })] }),
      );
      renderHook(() => useDashboard());
      await flush();
      expect(badge.set).toHaveBeenCalledWith(1);

      const nav = navigator as {
        setAppBadge?: unknown;
        clearAppBadge?: unknown;
      };
      delete nav.setAppBadge;
      delete nav.clearAppBadge;
      serve(withCs({ status: 'ok', data: [] }));
      const { result } = renderHook(() => useDashboard());
      await flush();
      expect(result.current.error).toBeNull();
    });
  });

  describe('静的プレビュー', () => {
    beforeEach(() => setPreview(true));

    it('取得しない', async () => {
      const { result } = renderHook(() => useDashboard());
      await flush();
      expect(get).not.toHaveBeenCalled();
      expect(result.current.data).toBeNull();
    });

    it('停止はできない', async () => {
      const { result } = renderHook(() => useDashboard());
      await expect(result.current.stopCodespace('x')).rejects.toThrow(
        '静的プレビューでは停止できません',
      );
      expect(post).not.toHaveBeenCalled();
    });
  });
});
