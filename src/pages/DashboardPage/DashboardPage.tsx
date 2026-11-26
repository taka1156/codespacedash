import { ActionsPanel } from '@/components/ActionsPanel/ActionsPanel';
import { CloudflareUsagePanel } from '@/components/CloudflareUsagePanel/CloudflareUsagePanel';
import { CodespacesPanel } from '@/components/CodespacesPanel/CodespacesPanel';
import { CopilotPanel } from '@/components/CopilotPanel/CopilotPanel';
import { Header } from '@/components/Header/Header';
import { PanelTabs } from '@/components/shared/PanelTabs/PanelTabs';
import { WorkersPanel } from '@/components/WorkersPanel/WorkersPanel';
import { useDashboard } from '@/hooks/useDashboard';
import { type ServiceTab, useSettings } from '@/hooks/useSettings';
import { applyDebug, resolvePlans } from '@/lib/debug';
import { CLOUDFLARE_DAILY_FREE, CLOUDFLARE_STORAGE_FREE } from '@/lib/plans';
import { IS_STATIC_PREVIEW } from '@/lib/preview';
import type { DashboardResponse } from '@/lib/types';
import { buildKind } from '@/lib/workerBuildKind';
import {
  app,
  dashboardGrid,
  errorBanner,
  main,
  previewBanner,
  serviceTabs,
  skeletonPanel,
} from './style.css';

/** 反対側のタブを見ていても気づけるように、赤い点を出す条件 */
const githubAlert = (d: DashboardResponse) =>
  d.github.runs.status === 'ok' &&
  d.github.runs.data.some(
    (r) => r.status === 'completed' && r.conclusion === 'failure',
  );

const cloudflareAlert = (d: DashboardResponse) =>
  d.cloudflare.builds.status === 'ok' &&
  d.cloudflare.builds.data.builds.some((b) => buildKind(b) === 'failure');

export const DashboardPage = () => {
  const { settings, update, updateDebug } = useSettings();
  const {
    data: rawData,
    loading,
    error,
    sessionExpired,
    lastFetched,
    fetchAll,
    stopCodespace,
  } = useDashboard();

  const data = applyDebug(rawData, settings);
  const plans = resolvePlans(settings, data);
  const tab = settings.serviceTab;

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
      />
      <main className={main}>
        {IS_STATIC_PREVIEW && (
          <div className={previewBanner}>
            静的プレビューです。表示はすべて疑似データで、GitHub や Cloudflare
            には接続していません。右上の ⚙
            →「デバッグ」で数値やプラン、取得状態を変えられます。
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
        <PanelTabs<ServiceTab>
          label="サービスの切り替え"
          className={serviceTabs}
          current={tab}
          onChange={(serviceTab) => update({ serviceTab })}
          items={[
            {
              key: 'github',
              label: '⬡ GitHub',
              alert: data ? githubAlert(data) : false,
            },
            {
              key: 'cloudflare',
              label: '☁\uFE0E Cloudflare',
              alert: data ? cloudflareAlert(data) : false,
            },
          ]}
        />
        {!data ? (
          loading && (
            <div className={dashboardGrid}>
              {[1, 2, 3].map((i) => (
                <div key={i} className={skeletonPanel} />
              ))}
            </div>
          )
        ) : tab === 'github' ? (
          <div className={dashboardGrid}>
            <CodespacesPanel
              codespaces={data.github.codespaces}
              notifyAfterMin={data.notifyAfterMin}
              onStop={stopCodespace}
              billing={data.github.billing}
              plan={plans.github}
            />
            <ActionsPanel
              billing={data.github.billing}
              runs={data.github.runs}
              plan={plans.github}
            />
            <CopilotPanel
              premiumRequests={data.github.copilot}
              plan={plans.copilot}
            />
          </div>
        ) : (
          <div className={dashboardGrid}>
            <WorkersPanel
              builds={data.cloudflare.builds}
              plan={plans.workers}
            />
            <CloudflareUsagePanel
              title="日次の無料枠"
              icon="◷"
              subTitle="毎日 9:00（00:00 UTC）にリセット"
              items={CLOUDFLARE_DAILY_FREE}
              note="Workers Free の上限です。超えるとその日はリクエストやクエリが失敗します（Paid は超過分が従量課金）。"
            />
            <CloudflareUsagePanel
              title="ストレージ・月次"
              icon="▤"
              subTitle="R2 は月次、D1 ストレージは総量"
              items={CLOUDFLARE_STORAGE_FREE}
              note="R2 の操作回数は毎月リセット。D1 ストレージはアカウント全体の合計（Free は 1 DB 500 MB まで）。"
            />
          </div>
        )}
      </main>
    </div>
  );
};
