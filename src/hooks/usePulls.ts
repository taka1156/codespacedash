import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from '@/lib/api';
import { IS_STATIC_PREVIEW } from '@/lib/preview';
import type { PullsResponse, RepoCandidatesResponse } from '@/lib/types';

const REFRESH_MS = 60_000;

const messageOf = (e: unknown) => (e instanceof Error ? e.message : String(e));

/** お気に入りリポジトリのオープンな PR。お気に入りが変わったら取り直す */
export const usePulls = (repos: readonly string[]) => {
  const key = repos.join(',');
  const [data, setData] = useState<PullsResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // お気に入りを続けて変えたときに、古い応答で上書きしない
  const latest = useRef(0);

  const fetchPulls = useCallback(async () => {
    if (IS_STATIC_PREVIEW) {
      return;
    }
    const id = ++latest.current;
    if (key === '') {
      setData(null);
      setError(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await api.get<PullsResponse>(
        `/pulls?repos=${encodeURIComponent(key)}`,
      );
      if (id === latest.current) {
        setData(res);
      }
    } catch (e) {
      if (id === latest.current) {
        setError(messageOf(e));
      }
    } finally {
      if (id === latest.current) {
        setLoading(false);
      }
    }
  }, [key]);

  useEffect(() => {
    fetchPulls();
  }, [fetchPulls]);

  useEffect(() => {
    const timer = setInterval(() => {
      if (!document.hidden) {
        fetchPulls();
      }
    }, REFRESH_MS);
    const onVisible = () => {
      if (!document.hidden) {
        fetchPulls();
      }
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [fetchPulls]);

  return { data, loading, error, fetchPulls };
};

/** 静的プレビューで出す登録の候補 */
export const PREVIEW_CANDIDATES = [
  'example/web-app',
  'example/api-server',
  'example/docs-site',
  'example/infra',
];

/** お気に入りに登録するときの候補。初めて必要になったときに1回だけ取る */
export const useRepoCandidates = (enabled: boolean) => {
  const [repos, setRepos] = useState<string[] | null>(
    IS_STATIC_PREVIEW ? PREVIEW_CANDIDATES : null,
  );
  const [error, setError] = useState<string | null>(null);
  const started = useRef(false);

  useEffect(() => {
    if (!enabled || started.current || IS_STATIC_PREVIEW) {
      return;
    }
    started.current = true;
    api
      .get<RepoCandidatesResponse>('/repos')
      .then((res) => {
        if (res.repos.status === 'ok') {
          setRepos(res.repos.data);
        } else {
          setError(
            res.repos.status === 'forbidden'
              ? `権限不足（${res.repos.permission}）`
              : '取得できませんでした',
          );
        }
      })
      .catch((e: unknown) => setError(messageOf(e)));
  }, [enabled]);

  return { repos, error };
};
