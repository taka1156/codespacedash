import { ActionsPanel } from '@/components/ActionsPanel/ActionsPanel';
import { ClaudePanel } from '@/components/ClaudePanel/ClaudePanel';
import { CodespacesPanel } from '@/components/CodespacesPanel/CodespacesPanel';
import { CopilotPanel } from '@/components/CopilotPanel/CopilotPanel';
import { Header } from '@/components/Header/Header';
import { useDashboard } from '@/hooks/useDashboard';
import { useSettings } from '@/hooks/useSettings';
import { applyDebug, resolvePlans } from '@/lib/debug';
import { IS_STATIC_PREVIEW } from '@/lib/preview';
import {
  app,
  dashboardGrid,
  errorBanner,
  loadingGrid,
  main,
  previewBanner,
  skeletonPanel,
} from './style.css';

export const DashboardPage = () => {
  const { settings, update, updateDebug } = useSettings();
  const { aiProvider } = settings;
  const {
    data: rawData,
    loading,
    error,
    sessionExpired,
    lastFetched,
    fetchAll,
    stopCodespace,
  } = useDashboard(aiProvider);

  const data = applyDebug(rawData, settings);
  const plans = resolvePlans(settings, data);
  const sectionErrors = data ? Object.values(data.errors) : [];

  return (
    <div className={app}>
      <Header
        user={data?.user ?? null}
        onRefresh={fetchAll}
        loading={loading}
        lastFetched={lastFetched}
        settings={settings}
        plans={plans}
        onChangeSettings={update}
        onChangeDebug={updateDebug}
        claudeConfigured={data?.claudeConfigured}
      />
      <main className={main}>
        {IS_STATIC_PREVIEW && (
          <div className={previewBanner}>
            静的プレビューです。表示はすべて疑似データで、GitHub や Anthropic
            には接続していません。右上の ⚙
            →「デバッグ」で数値やプランを変えられます。
          </div>
        )}
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
              billingSummary={data.billingSummary}
              plan={plans.github}
            />
            <ActionsPanel
              summary={data.billingSummary}
              runs={data.workflowRuns}
              plan={plans.github}
            />
            {data.aiProvider !== aiProvider && loading ? (
              <div className={skeletonPanel} />
            ) : aiProvider === 'claude' ? (
              <ClaudePanel
                usage={data.claudeUsage}
                configured={data.claudeConfigured}
                plan={plans.claude}
              />
            ) : (
              <CopilotPanel
                premiumRequests={data.premiumRequests}
                plan={plans.copilot}
              />
            )}
          </div>
        )}
      </main>
    </div>
  );
};
