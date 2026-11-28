import clsx from 'clsx';
import { ActionsPanel } from '@/components/ActionsPanel/ActionsPanel';
import { CloudflareUsagePanel } from '@/components/CloudflareUsagePanel/CloudflareUsagePanel';
import { CodespacesPanel } from '@/components/CodespacesPanel/CodespacesPanel';
import { CopilotPanel } from '@/components/CopilotPanel/CopilotPanel';
import { Header } from '@/components/Header/Header';
import { PullsPanel } from '@/components/PullsPanel/PullsPanel';
import { PanelTabs } from '@/components/shared/PanelTabs/PanelTabs';
import {
  IssueStrips,
  StatusFooter,
  StatusScope,
} from '@/components/shared/ServiceStatus/ServiceStatus';
import { WorkersPanel } from '@/components/WorkersPanel/WorkersPanel';
import { useDashboard } from '@/hooks/useDashboard';
import { usePulls } from '@/hooks/usePulls';
import { routeHref, useRoute } from '@/hooks/useRoute';
import { type ServiceTab, useSettings } from '@/hooks/useSettings';
import { usageValues } from '@/lib/cloudflareUsage';
import { applyDebug, applyPullsDebug, resolvePlans } from '@/lib/debug';
import { CLOUDFLARE_DAILY_FREE, CLOUDFLARE_STORAGE_FREE } from '@/lib/plans';
import { IS_STATIC_PREVIEW } from '@/lib/preview';
import { totalPulls } from '@/lib/pulls';
import { issuesFor, STATUS_COMPONENTS as SC } from '@/lib/serviceStatus';
import { alertText, tokenAlerts } from '@/lib/tokens';
import { startTour } from '@/lib/tour';
import type { DashboardResponse } from '@/lib/types';
import { buildKind } from '@/lib/workerBuildKind';
import { SettingsPage } from '../SettingsPage/SettingsPage';
import {
  app,
  dashboardGrid,
  errorBanner,
  main,
  previewBanner,
  serviceTabs,
  skeletonPanel,
  tokenBanner,
  tokenBannerDanger,
  tokenBannerLink,
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

// 取得したデータと設定はダッシュボードと設定ページで共有するので、
// 画面の切り替えもここで行う（設定ページを開いても取り直さない）
export const DashboardPage = () => {
  const { route, navigate } = useRoute();
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

  const pulls = usePulls(settings.favorites);

  const data = applyDebug(rawData, settings);
  const pullsData = applyPullsDebug(pulls.data, settings);
  const pullsTotal = totalPulls(pullsData?.pulls ?? null);
  const plans = resolvePlans(settings, data);
  const tab = settings.serviceTab;
  const alerts = tokenAlerts(data);

  // 公式ステータスページの障害（取得前は何もない）
  const gh = data?.serviceStatus.github ?? [];
  const cf = data?.serviceStatus.cloudflare ?? [];
  const ghCommon = issuesFor(gh, [SC.github.common]);
  const cfCommon = issuesFor(cf, [SC.cloudflare.common]);
  const ghScope = (names: string[]) => ({
    service: 'github' as const,
    issues: issuesFor(gh, names),
    common: ghCommon,
  });
  const cfScope = (names: string[]) => ({
    service: 'cloudflare' as const,
    issues: issuesFor(cf, names),
    common: cfCommon,
  });
  const pullsIssues = issuesFor(gh, [SC.github.pulls]);

  if (route.page === 'settings') {
    return (
      <SettingsPage
        section={route.section}
        onSection={(section) => navigate({ page: 'settings', section })}
        settings={settings}
        plans={plans}
        tokens={data?.tokens ?? null}
        tokenAlert={alerts.length > 0}
        onChange={update}
        onChangeDebug={updateDebug}
      />
    );
  }

  return (
    <div className={app}>
      <Header
        user={data?.user ?? null}
        onRefresh={() => {
          fetchAll();
          pulls.fetchPulls();
        }}
        loading={loading || pulls.loading}
        lastFetched={lastFetched}
        debug={settings.debug.enabled}
        settingsAlert={alerts.length > 0}
        onHelp={() => startTour(tab)}
      />
      <main className={main}>
        {alerts.map((a) => (
          <div
            key={a.key}
            role="alert"
            className={clsx(
              tokenBanner,
              a.level !== 'warn' && tokenBannerDanger,
            )}
          >
            <span>{alertText(a)}</span>
            <a
              className={tokenBannerLink}
              href={routeHref({ page: 'settings', section: 'tokens' })}
            >
              確認
            </a>
          </div>
        ))}
        {IS_STATIC_PREVIEW && (
          <div className={previewBanner}>
            静的プレビューです。表示はすべて疑似データで、GitHub や Cloudflare
            には接続していません。右上の設定（歯車）
            →「デバッグ」で数値やプラン、取得状態、トークンの期限を変えられます。
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
          tour="tabs"
          current={tab}
          onChange={(serviceTab) => update({ serviceTab })}
          items={[
            {
              key: 'github',
              label: '⬡ GitHub',
              alert: data ? githubAlert(data) : false,
              outage: gh.some((i) => i.component !== SC.github.pulls),
            },
            {
              key: 'cloudflare',
              label: '☁\uFE0E Cloudflare',
              alert: data ? cloudflareAlert(data) : false,
              outage: cf.length > 0,
            },
            {
              key: 'pulls',
              label: pullsTotal === null ? '⇄ PR' : `⇄ PR (${pullsTotal})`,
              outage: ghCommon.length + pullsIssues.length > 0,
            },
          ]}
        />
        {/* API など、そのサービスのパネル全部に関係する障害はタブの上に1回だけ出す */}
        <IssueStrips
          service={tab === 'cloudflare' ? 'cloudflare' : 'github'}
          issues={tab === 'cloudflare' ? cfCommon : ghCommon}
        />
        {tab === 'pulls' ? (
          <StatusScope {...ghScope([SC.github.pulls])}>
            <IssueStrips service="github" issues={pullsIssues} />
            <div data-tour="panels">
              <PullsPanel
                favorites={settings.favorites}
                pulls={pullsData?.pulls ?? null}
                error={pulls.error}
              />
            </div>
          </StatusScope>
        ) : !data ? (
          loading && (
            <div className={dashboardGrid}>
              {[1, 2, 3].map((i) => (
                <div key={i} className={skeletonPanel} />
              ))}
            </div>
          )
        ) : tab === 'github' ? (
          <div className={dashboardGrid} data-tour="panels">
            <StatusScope {...ghScope([SC.github.codespaces])}>
              <CodespacesPanel
                codespaces={data.github.codespaces}
                notifyAfterMin={data.notifyAfterMin}
                onStop={stopCodespace}
                billing={data.github.billing}
                plan={plans.github}
              />
            </StatusScope>
            <StatusScope {...ghScope([SC.github.actions])}>
              <ActionsPanel
                billing={data.github.billing}
                runs={data.github.runs}
                plan={plans.github}
              />
            </StatusScope>
            <StatusScope {...ghScope([SC.github.copilot])}>
              <CopilotPanel
                premiumRequests={data.github.copilot}
                plan={plans.copilot}
              />
            </StatusScope>
          </div>
        ) : (
          <div className={dashboardGrid} data-tour="panels">
            <StatusScope {...cfScope([SC.cloudflare.builds])}>
              <WorkersPanel
                builds={data.cloudflare.builds}
                plan={plans.workers}
              />
            </StatusScope>
            <StatusScope
              {...cfScope([
                SC.cloudflare.workers,
                SC.cloudflare.kv,
                SC.cloudflare.analytics,
              ])}
            >
              <CloudflareUsagePanel
                title="日次の無料枠"
                icon="◷"
                subTitle="毎日 9:00（00:00 UTC）にリセット"
                items={CLOUDFLARE_DAILY_FREE}
                values={usageValues(data.cloudflare.usage, 'daily')}
                note="Workers Free の上限です。超えるとその日はリクエストやクエリが失敗します（Paid は超過分が従量課金）。Analytics の集計なので数分遅れることがあります。"
              />
            </StatusScope>
            <StatusScope
              {...cfScope([SC.cloudflare.kv, SC.cloudflare.analytics])}
            >
              <CloudflareUsagePanel
                title="ストレージ・月次"
                icon="▤"
                subTitle="R2 の操作は月次、ストレージは今の量"
                items={CLOUDFLARE_STORAGE_FREE}
                values={usageValues(data.cloudflare.usage, 'monthly')}
                note="R2 の操作回数は UTC の今月の合計（削除は無料なので含めない）。ストレージは今の保存量（D1・KV はアカウント全体の合計。D1 は Free だと 1 DB 500 MB まで）。KV ストレージは Paid でも 1 GB を超えた分が従量課金。"
              />
            </StatusScope>
          </div>
        )}
        <StatusFooter />
      </main>
    </div>
  );
};
