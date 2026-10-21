import { useCallback, useState } from 'react';
import { apiFetch } from '../lib/api';
import type {
  BillingUsageSummary,
  Codespace,
  GithubUser,
  PremiumRequestUsage,
} from '../lib/types';

export interface DashboardData {
  codespaces: Codespace[];
  billingSummary: BillingUsageSummary | null;
  premiumRequests: PremiumRequestUsage | null;
}

export const useDashboard = (token: string) => {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastFetched, setLastFetched] = useState<Date | null>(null);

  const fetchAll = useCallback(async () => {
    if (!token) {
      return;
    }
    setLoading(true);
    setError(null);
    try {
      // まずユーザー情報取得
      const user = await apiFetch<GithubUser>('/user', token);
      const login = user.login;
      // Codespaces
      const codespacesRes = await apiFetch<{
        codespaces: Codespace[];
        total_count: number;
      }>('/user/codespaces', token);

      // Billing Usage Summary
      const now = new Date();
      const params = new URLSearchParams({
        year: String(now.getFullYear()),
        month: String(now.getMonth() + 1),
      });

      const billingSummary = await apiFetch<BillingUsageSummary>(
        `/users/${login}/settings/billing/usage/summary?${params}`,
        token,
      );

      // Premium Request Usage
      const premiumRequests = await apiFetch<PremiumRequestUsage>(
        `/users/${login}/settings/billing/ai_credit/usage?${params}`,
        token,
      );

      setData({
        codespaces: codespacesRes.codespaces,
        billingSummary,
        premiumRequests,
      });

      setLastFetched(new Date());
    } catch (e: unknown) {
      if (e instanceof Error) {
        setError(e.message);
      }
    } finally {
      setLoading(false);
    }
  }, [token]);

  return { data, loading, error, lastFetched, fetchAll };
};
