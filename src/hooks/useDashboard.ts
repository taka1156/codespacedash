import { useCallback, useEffect, useRef, useState } from 'react';
import { api, SessionExpiredError } from '@/lib/api';
import type { DashboardResponse } from '@/lib/types';

const REFRESH_MS = 60_000;

// Badging API（インストールしたPWAのアイコンに数字を出す）。非対応環境では何もしない
const setAppBadge = (count: number) => {
  const nav = navigator as Navigator & {
    setAppBadge?: (n?: number) => Promise<void>;
    clearAppBadge?: () => Promise<void>;
  };
  const p = count > 0 ? nav.setAppBadge?.(count) : nav.clearAppBadge?.();
  p?.catch(() => {});
};

export const useDashboard = () => {
  const [data, setData] = useState<DashboardResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sessionExpired, setSessionExpired] = useState(false);
  const inFlight = useRef(false);

  const fetchAll = useCallback(async () => {
    if (inFlight.current) {
      return;
    }
    inFlight.current = true;
    setLoading(true);
    setError(null);
    try {
      setData(await api.get<DashboardResponse>('/dashboard'));
    } catch (e) {
      if (e instanceof SessionExpiredError) {
        setSessionExpired(true);
      }
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      inFlight.current = false;
      setLoading(false);
    }
  }, []);

  const stopCodespace = useCallback(
    async (name: string) => {
      await api.post(`/codespaces/${encodeURIComponent(name)}/stop`);
      // 停止処理は数秒かかるので少し待ってから再取得
      setTimeout(fetchAll, 3000);
    },
    [fetchAll],
  );

  useEffect(() => {
    fetchAll();
    const timer = setInterval(() => {
      if (!document.hidden) {
        fetchAll();
      }
    }, REFRESH_MS);
    const onVisible = () => {
      if (!document.hidden) {
        fetchAll();
      }
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [fetchAll]);

  // タブのタイトルに稼働中の台数、アプリアイコンのバッジにつけっぱなしの台数を出す
  useEffect(() => {
    if (!data?.codespaces) {
      return;
    }
    const running = data.codespaces.filter(
      (c) => c.state === 'Available',
    ).length;
    document.title = running ? `(${running}) CodespaceDash` : 'CodespaceDash';

    const forgotten = data.codespaces.filter(
      (c) =>
        c.state === 'Available' &&
        c.last_used_at &&
        (Date.now() - new Date(c.last_used_at).getTime()) / 60_000 >=
          data.notifyAfterMin,
    ).length;
    setAppBadge(forgotten);
  }, [data]);

  return {
    data,
    loading,
    error,
    sessionExpired,
    lastFetched: data ? new Date(data.fetchedAt) : null,
    fetchAll,
    stopCodespace,
  };
};
