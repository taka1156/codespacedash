import { useCallback, useEffect, useRef, useState } from 'react';
import { api, SessionExpiredError } from '@/lib/api';
import type { DashboardResponse } from '@/lib/types';

const REFRESH_MS = 60_000;

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

  // タブのタイトルに稼働中の台数を出す
  useEffect(() => {
    const running =
      data?.codespaces?.filter((c) => c.state === 'Available').length ?? 0;
    document.title = running ? `(${running}) CodespaceDash` : 'CodespaceDash';
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
