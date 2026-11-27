import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError, api } from '@/lib/api';
import type { PullsResponse } from '@/lib/types';
import { NOW, repoPulls } from '@/testing/fixtures';
import { setPreview } from '@/testing/previewMock';
import { PREVIEW_CANDIDATES, usePulls, useRepoCandidates } from './usePulls';

vi.mock('@/lib/preview', () =>
  import('@/testing/previewMock').then((m) => m.previewModule),
);
vi.mock('@/lib/api', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/api')>()),
  api: { get: vi.fn(), post: vi.fn(), delete: vi.fn() },
}));

const get = vi.mocked(api.get);

const flush = () => act(async () => {});

const setHidden = (hidden: boolean) => {
  Object.defineProperty(document, 'hidden', {
    configurable: true,
    value: hidden,
  });
};

const response = (repo = 'me/app'): PullsResponse => ({
  pulls: { status: 'ok', data: [repoPulls({ repo })] },
  fetchedAt: NOW.toISOString(),
});

/** 呼ばれた順に解決できる Promise を返す */
const deferred = <T>() => {
  let resolve!: (v: T) => void;
  let reject!: (e: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
};

beforeEach(() => {
  vi.useFakeTimers({ now: NOW });
  get.mockReset();
  get.mockResolvedValue(response());
  setHidden(false);
});

describe('usePulls', () => {
  it('お気に入りをクエリに入れて取得する', async () => {
    const { result } = renderHook(() => usePulls(['me/app', 'org/lib']));
    expect(result.current.loading).toBe(true);
    await flush();
    expect(get).toHaveBeenCalledWith(
      `/pulls?repos=${encodeURIComponent('me/app,org/lib')}`,
    );
    expect(result.current).toMatchObject({
      data: response(),
      loading: false,
      error: null,
    });
  });

  it('お気に入りがなければ取得せず、空にする', async () => {
    const { result, rerender } = renderHook(({ repos }) => usePulls(repos), {
      initialProps: { repos: ['me/app'] },
    });
    await flush();
    expect(result.current.data).not.toBeNull();

    rerender({ repos: [] });
    await flush();
    expect(get).toHaveBeenCalledTimes(1);
    expect(result.current).toMatchObject({
      data: null,
      loading: false,
      error: null,
    });
  });

  it('お気に入りが変わったら取り直す（同じ中身なら取り直さない）', async () => {
    const { rerender } = renderHook(({ repos }) => usePulls(repos), {
      initialProps: { repos: ['me/app'] },
    });
    await flush();
    rerender({ repos: ['me/app'] });
    await flush();
    expect(get).toHaveBeenCalledTimes(1);
    rerender({ repos: ['me/app', 'org/lib'] });
    await flush();
    expect(get).toHaveBeenCalledTimes(2);
  });

  it('古い応答で新しい結果を上書きしない', async () => {
    const first = deferred<PullsResponse>();
    const second = deferred<PullsResponse>();
    get
      .mockReturnValueOnce(first.promise as never)
      .mockReturnValueOnce(second.promise as never);
    const { result, rerender } = renderHook(({ repos }) => usePulls(repos), {
      initialProps: { repos: ['me/old'] },
    });
    rerender({ repos: ['me/new'] });

    await act(async () => second.resolve(response('me/new')));
    await act(async () => first.resolve(response('me/old')));
    expect(result.current.data).toEqual(response('me/new'));
    expect(result.current.loading).toBe(false);
  });

  it('古いリクエストの失敗は無視する', async () => {
    const first = deferred<PullsResponse>();
    get.mockReturnValueOnce(first.promise as never);
    const { result, rerender } = renderHook(({ repos }) => usePulls(repos), {
      initialProps: { repos: ['me/old'] },
    });
    rerender({ repos: ['me/new'] });
    await flush();
    await act(async () => first.reject(new Error('old')));
    expect(result.current.error).toBeNull();
  });

  it('失敗したらメッセージを残し、前の結果は消さない', async () => {
    const { result } = renderHook(() => usePulls(['me/app']));
    await flush();
    get.mockRejectedValueOnce(new ApiError(502, 'GitHub API 502'));
    await act(() => result.current.fetchPulls());
    expect(result.current.error).toBe('GitHub API 502');
    expect(result.current.data).toEqual(response());

    get.mockRejectedValueOnce('down');
    await act(() => result.current.fetchPulls());
    expect(result.current.error).toBe('down');
  });

  it('1分ごと・表に戻ったときに取り直す（裏にあるときは取らない）', async () => {
    renderHook(() => usePulls(['me/app']));
    await flush();
    await act(() => vi.advanceTimersByTimeAsync(60_000));
    expect(get).toHaveBeenCalledTimes(2);

    setHidden(true);
    await act(() => vi.advanceTimersByTimeAsync(60_000));
    document.dispatchEvent(new Event('visibilitychange'));
    await flush();
    expect(get).toHaveBeenCalledTimes(2);

    setHidden(false);
    document.dispatchEvent(new Event('visibilitychange'));
    await flush();
    expect(get).toHaveBeenCalledTimes(3);
  });

  it('外したらタイマーとイベントを止める', async () => {
    const { unmount } = renderHook(() => usePulls(['me/app']));
    await flush();
    unmount();
    await act(() => vi.advanceTimersByTimeAsync(60_000));
    document.dispatchEvent(new Event('visibilitychange'));
    expect(get).toHaveBeenCalledTimes(1);
  });

  it('静的プレビューでは取得しない', async () => {
    setPreview(true);
    const { result } = renderHook(() => usePulls(['me/app']));
    await flush();
    await act(() => result.current.fetchPulls());
    expect(get).not.toHaveBeenCalled();
    expect(result.current).toMatchObject({ data: null, loading: false });
  });
});

describe('useRepoCandidates', () => {
  it('必要になったときに1回だけ取る', async () => {
    get.mockResolvedValue({ repos: { status: 'ok', data: ['me/app'] } });
    const { result, rerender } = renderHook(({ on }) => useRepoCandidates(on), {
      initialProps: { on: false },
    });
    await flush();
    expect(get).not.toHaveBeenCalled();
    expect(result.current.repos).toBeNull();

    rerender({ on: true });
    await flush();
    expect(get).toHaveBeenCalledWith('/repos');
    expect(result.current).toEqual({ repos: ['me/app'], error: null });

    rerender({ on: false });
    rerender({ on: true });
    await flush();
    expect(get).toHaveBeenCalledTimes(1);
  });

  it('権限不足は足りない権限名を、それ以外は理由を出す', async () => {
    get.mockResolvedValueOnce({
      repos: { status: 'forbidden', permission: 'Metadata: Read', message: '' },
    });
    const a = renderHook(() => useRepoCandidates(true));
    await flush();
    expect(a.result.current).toEqual({
      repos: null,
      error: '権限不足（Metadata: Read）',
    });

    get.mockResolvedValueOnce({ repos: { status: 'error', message: 'x' } });
    const b = renderHook(() => useRepoCandidates(true));
    await flush();
    expect(b.result.current.error).toBe('取得できませんでした');

    get.mockRejectedValueOnce(new Error('offline'));
    const c = renderHook(() => useRepoCandidates(true));
    await flush();
    expect(c.result.current.error).toBe('offline');

    get.mockRejectedValueOnce('offline?');
    const d = renderHook(() => useRepoCandidates(true));
    await flush();
    expect(d.result.current.error).toBe('offline?');
  });

  it('静的プレビューでは取らずに疑似の候補を出す', async () => {
    setPreview(true);
    const { result } = renderHook(() => useRepoCandidates(true));
    await flush();
    expect(get).not.toHaveBeenCalled();
    expect(result.current.repos).toEqual(PREVIEW_CANDIDATES);
  });
});
