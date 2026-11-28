// 公式ステータスページで見るコンポーネントと、表示用の文言。
// 画面（パネルの帯・タブの印）と Cron の通知で同じものを使う
import type { ComponentStatus, ServiceIssue, StatusService } from './types';

export const STATUS_PAGE: Record<
  StatusService,
  { service: string; name: string; url: string }
> = {
  github: {
    service: 'GitHub',
    name: 'GitHub Status',
    url: 'https://www.githubstatus.com',
  },
  cloudflare: {
    service: 'Cloudflare',
    name: 'Cloudflare Status',
    url: 'https://www.cloudflarestatus.com',
  },
};

/**
 * パネルごとに見るコンポーネント（ステータスページでの名前）。
 * common はそのサービスのパネル全部に関係するもの（API が落ちると全部取れない）
 */
export const STATUS_COMPONENTS = {
  github: {
    common: 'API Requests',
    codespaces: 'Codespaces',
    actions: 'Actions',
    copilot: 'Copilot',
    pulls: 'Pull Requests',
  },
  cloudflare: {
    common: 'API',
    builds: 'Workers Builds',
    workers: 'Workers',
    kv: 'Workers KV',
    analytics: 'Analytics',
  },
} as const satisfies Record<StatusService, Record<string, string>>;

/** ステータスページから拾うコンポーネント名の一覧 */
export const watchedComponents = (service: StatusService): string[] =>
  Object.values(STATUS_COMPONENTS[service]);

// 状態名だけ日本語にする（障害のタイトルは英語のまま。i18n のときにここを差し替える）
export const STATUS_LABEL: Record<ComponentStatus, string> = {
  degraded_performance: '性能低下',
  partial_outage: '一部障害',
  major_outage: '全面障害',
  under_maintenance: 'メンテナンス中',
};

/** 赤で出す（使えない・使えないことがある）状態か。そうでなければ黄 */
export const isSevere = (status: ComponentStatus) =>
  status === 'partial_outage' || status === 'major_outage';

/** 例: 「性能低下：Actions」 */
export const issueLabel = (issue: ServiceIssue) =>
  `${STATUS_LABEL[issue.status]}：${issue.component}`;

/** names のどれかに当たる障害だけを残す */
export const issuesFor = (issues: ServiceIssue[], names: readonly string[]) =>
  issues.filter((i) => names.includes(i.component));
