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
  get.mockResolvedValue(dashboard());
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
    expect(get).toHaveBeenCalledTimes(1);

    await act(() => vi.advanceTimersByTimeAsync(60_000));
    expect(get).toHaveBeenCalledTimes(2);

    setHidden(true);
    await act(() => vi.advanceTimersByTimeAsync(60_000));
    expect(get).toHaveBeenCalledTimes(2);
  });

  it('タブが表に戻ったら取り直す', async () => {
    renderHook(() => useDashboard());
    await flush();

    setHidden(true);
    document.dispatchEvent(new Event('visibilitychange'));
    await flush();
    expect(get).toHaveBeenCalledTimes(1);

    setHidden(false);
    document.dispatchEvent(new Event('visibilitychange'));
    await flush();
    expect(get).toHaveBeenCalledTimes(2);
  });

  it('外したら定期取得とイベントを止める', async () => {
    const { unmount } = renderHook(() => useDashboard());
    await flush();
    unmount();
    await act(() => vi.advanceTimersByTimeAsync(120_000));
    document.dispatchEvent(new Event('visibilitychange'));
    expect(get).toHaveBeenCalledTimes(1);
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
    expect(get).toHaveBeenCalledTimes(1);

    const second = dashboard({ notifyAfterMin: 5 });
    get.mockResolvedValueOnce(second);
    await act(async () => resolve(dashboard()));
    expect(get).toHaveBeenCalledTimes(2);
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

  it('停止したら3秒後に取り直す', async () => {
    const { result } = renderHook(() => useDashboard());
    await flush();
    await act(() => result.current.stopCodespace('a b'));
    expect(post).toHaveBeenCalledWith('/codespaces/a%20b/stop');
    expect(get).toHaveBeenCalledTimes(1);
    await act(() => vi.advanceTimersByTimeAsync(3000));
    expect(get).toHaveBeenCalledTimes(2);
  });

  describe('タイトルとバッジ', () => {
    const withCs = (
      codespaces: DashboardResponse['github']['codespaces'],
      notifyAfterMin = 60,
    ) => dashboard({ github: { codespaces }, notifyAfterMin });

    it('稼働中の台数をタイトルに、つけっぱなしの台数をバッジに出す', async () => {
      get.mockResolvedValue(
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
      get.mockResolvedValue(
        withCs({ status: 'ok', data: [codespace({ state: 'Shutdown' })] }),
      );
      renderHook(() => useDashboard());
      await flush();
      expect(document.title).toBe('QuotaDash');
      expect(badge.clear).toHaveBeenCalled();
    });

    it('一覧が取れなければ何も変えない', async () => {
      document.title = '(3) QuotaDash';
      get.mockResolvedValue(withCs({ status: 'error', message: 'x' }));
      renderHook(() => useDashboard());
      await flush();
      expect(document.title).toBe('(3) QuotaDash');
      expect(badge.set).not.toHaveBeenCalled();
      expect(badge.clear).not.toHaveBeenCalled();
    });

    it('バッジの失敗は無視し、非対応のブラウザでも落ちない', async () => {
      badge.set.mockRejectedValue(new Error('NotAllowed'));
      get.mockResolvedValue(
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
      get.mockResolvedValue(withCs({ status: 'ok', data: [] }));
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
