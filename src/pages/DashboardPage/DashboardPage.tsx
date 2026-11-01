import { ActionsPanel } from '@/components/ActionsPanel/ActionsPanel';
import { CodespacesPanel } from '@/components/CodespacesPanel/CodespacesPanel';
import { CopilotPanel } from '@/components/CopilotPanel/CopilotPanel';
import { Header } from '@/components/Header/Header';
import { useDashboard } from '@/hooks/useDashboard';
import {
  app,
  dashboardGrid,
  errorBanner,
  loadingGrid,
  main,
  skeletonPanel,
} from './style.css';

export const DashboardPage = () => {
  const {
    data,
    loading,
    error,
    sessionExpired,
    lastFetched,
    fetchAll,
    stopCodespace,
  } = useDashboard();

  const sectionErrors = data ? Object.values(data.errors) : [];

  return (
    <div className={app}>
      <Header
        user={data?.user ?? null}
        onRefresh={fetchAll}
        loading={loading}
        lastFetched={lastFetched}
      />
      <main className={main}>
        {error && (
          <div className={errorBanner}>
            ⚠️ {error}
            {sessionExpired && (
              <>
                {' '}
                <button
                  type="button"
                  onClick={() => location.reload()}
                  style={{ color: 'inherit', textDecoration: 'underline' }}
                >
                  再読み込み
                </button>
              </>
            )}
          </div>
        )}
        {sectionErrors.length > 0 && (
          <div className={errorBanner}>
            {sectionErrors.map((m) => (
              <div key={m}>⚠️ {m}</div>
            ))}
          </div>
        )}
        {loading && !data && (
          <div className={loadingGrid}>
            {[1, 2, 3].map((i) => (
              <div key={i} className={skeletonPanel} />
            ))}
          </div>
        )}
        {data && (
          <div className={dashboardGrid}>
            <CodespacesPanel
              codespaces={data.codespaces ?? []}
              notifyAfterMin={data.notifyAfterMin}
              onStop={stopCodespace}
            />
            <ActionsPanel summary={data.billingSummary} />
            <CopilotPanel premiumRequests={data.premiumRequests} />
          </div>
        )}
      </main>
    </div>
  );
};
