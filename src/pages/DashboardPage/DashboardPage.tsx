import { useEffect } from 'react';
import { ActionsPanel } from '@/components/ActionsPanel/ActionsPanel';
import { CodespacesPanel } from '@/components/CodespacesPanel/CodespacesPanel';
import { CopilotPanel } from '@/components/CopilotPanel/CopilotPanel';
import { Header } from '@/components/Header/Header';
import { useDashboard } from '@/hooks/useDashboard';
import type { GithubUser } from '@/lib/types';
import {
  app,
  dashboardGrid,
  errorBanner,
  loadingGrid,
  main,
  skeletonPanel,
} from './style.css';

interface Props {
  user: GithubUser;
  token: string;
  onLogout: () => void;
}

export const DashboardPage = ({ user, token, onLogout }: Props) => {
  const { data, loading, error, lastFetched, fetchAll } = useDashboard(token);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  return (
    <div className={app}>
      <Header
        user={user}
        onLogout={onLogout}
        onRefresh={fetchAll}
        loading={loading}
        lastFetched={lastFetched}
      />
      <main className={main}>
        {error && <div className={errorBanner}>⚠️ {error}</div>}
        {loading && !data && (
          <div className={loadingGrid}>
            {[1, 2, 3].map((i) => (
              <div key={i} className={skeletonPanel} />
            ))}
          </div>
        )}
        {data && (
          <div className={dashboardGrid}>
            <CodespacesPanel codespaces={data.codespaces} />
            <ActionsPanel summary={data.billingSummary} />
            <CopilotPanel premiumRequests={data.premiumRequests} />
          </div>
        )}
      </main>
    </div>
  );
};
