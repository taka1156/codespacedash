// サーバー(Hono)とクライアント(React)で共有するレスポンス型。
// サーバーはGitHub APIの応答からここに定義したフィールドだけを抜き出して返す。

export interface GithubUser {
  login: string;
  name: string | null;
  avatar_url: string;
  html_url: string;
  plan: string | null;
}

export type CodespaceState =
  | 'Available'
  | 'Unavailable'
  | 'Deleted'
  | 'Starting'
  | 'Stopping'
  | 'Rebuilding'
  | 'ShuttingDown'
  | 'Shutdown'
  | 'Failed'
  | (string & {});

export interface Codespace {
  id: number;
  name: string;
  display_name: string | null;
  state: CodespaceState;
  machine: {
    name: string;
    display_name: string;
    cpus: number;
    memory_in_bytes: number;
    storage_in_bytes: number;
  } | null;
  repository: { full_name: string; html_url: string };
  created_at: string;
  last_used_at: string | null;
  location: string;
  retention_expires_at: string | null;
  idle_timeout_minutes: number | null;
  web_url: string;
  has_unpushed_changes: boolean;
}

// Billing API（/settings/billing/usage/summary）
export interface BillingUsageItem {
  product: string;
  sku: string;
  unitType: string;
  pricePerUnit: number;
  grossQuantity: number;
  grossAmount: number;
  discountQuantity: number;
  discountAmount: number;
  netQuantity: number;
  netAmount: number;
}

export interface BillingUsageSummary {
  timePeriod: { year: number; month?: number };
  usageItems: BillingUsageItem[];
}

// Copilot プレミアムリクエスト
export interface PremiumRequestItem extends BillingUsageItem {
  model: string;
}

export interface PremiumRequestUsage {
  timePeriod: { year: number; month?: number };
  usageItems: PremiumRequestItem[];
}

// Actions の実行履歴（最近 push された上位リポジトリから集約）
export interface WorkflowRun {
  id: number;
  repo: string;
  /** private リポジトリの実行か（public は Actions の無料枠を使わない） */
  private: boolean;
  workflowName: string;
  title: string;
  branch: string | null;
  event: string;
  status:
    | 'queued'
    | 'in_progress'
    | 'completed'
    | 'waiting'
    | 'requested'
    | 'pending'
    | (string & {});
  conclusion:
    | 'success'
    | 'failure'
    | 'cancelled'
    | 'skipped'
    | 'timed_out'
    | 'action_required'
    | 'neutral'
    | 'startup_failure'
    | (string & {})
    | null;
  runNumber: number;
  createdAt: string;
  startedAt: string | null;
  updatedAt: string;
  htmlUrl: string;
}

// お気に入りリポジトリのオープンな PR
export type PullReview = 'approved' | 'changes_requested' | 'review_required';

export interface PullRequest {
  number: number;
  title: string;
  url: string;
  draft: boolean;
  /** 退会したユーザーなどは null */
  author: string | null;
  branch: string;
  createdAt: string;
  updatedAt: string;
  /** レビューの状態。ブランチ保護でレビュー必須にしていなければ null */
  review: PullReview | null;
  comments: number;
}

export interface RepoPulls {
  /** 登録した名前（owner/repo） */
  repo: string;
  /** リポジトリが見つからない・トークンで見られないときは false */
  found: boolean;
  url: string;
  private: boolean;
  /** オープンな PR の総数（pulls は更新が新しい順に上限まで） */
  totalCount: number;
  pulls: PullRequest[];
}

// GET /api/pulls?repos=owner/a,owner/b
export interface PullsResponse {
  /** 登録した順に並ぶ */
  pulls: SectionState<RepoPulls[]>;
  fetchedAt: string;
}

// GET /api/repos（お気に入りに登録するときの候補）
export interface RepoCandidatesResponse {
  repos: SectionState<string[]>;
}

// Cloudflare Workers Builds（Git 連携している Worker のビルド）
export type WorkersPlan = 'free' | 'paid';

export interface WorkerBuild {
  id: string;
  worker: string;
  status: 'queued' | 'initializing' | 'running' | 'stopped' | (string & {});
  outcome:
    | 'success'
    | 'fail'
    | 'skipped'
    | 'cancelled'
    | 'terminated'
    | (string & {})
    | null;
  branch: string | null;
  commitHash: string | null;
  commitMessage: string | null;
  source: 'push' | 'pull_request' | 'manual' | 'api' | (string & {}) | null;
  repo: string | null;
  createdAt: string;
  startedAt: string | null;
  stoppedAt: string | null;
  dashboardUrl: string;
}

export interface WorkersBuildsSummary {
  /** 全 Worker の直近のビルド（新しい順） */
  builds: WorkerBuild[];
  /** Git 連携している Worker の数 */
  workerCount: number;
  /** 今期のビルド時間（分）。API に使用量がないため、ビルドの所要時間から推定 */
  usedMinutes: number;
  /** 集計期間（Free はビルド時間のリセット日基準、それ以外は今月） */
  period: { start: string; end: string };
  /** account limits の応答から推定したプラン（判定できなければ null） */
  detectedPlan: WorkersPlan | null;
  /** Free プランで上限に達しているか */
  limitReached: boolean;
}

// Cloudflare の無料枠の使用量（GraphQL Analytics）
export const CLOUDFLARE_DAILY_KEYS = [
  'workersRequests',
  'workersAiNeurons',
  'd1RowsRead',
  'd1RowsWritten',
  'kvReads',
  'kvWrites',
  'kvDeletes',
  'kvLists',
] as const;
export type CloudflareDailyKey = (typeof CLOUDFLARE_DAILY_KEYS)[number];

export const CLOUDFLARE_MONTHLY_KEYS = [
  'r2StorageGb',
  'r2ClassA',
  'r2ClassB',
  'd1StorageGb',
  'kvStorageGb',
] as const;
export type CloudflareMonthlyKey = (typeof CLOUDFLARE_MONTHLY_KEYS)[number];

export interface CloudflareUsage {
  /** UTC の今日（00:00 UTC〜）の使用量。項目ごとに取れたかどうかが違う */
  daily: Record<CloudflareDailyKey, SectionState<number>>;
  /** R2 の操作回数は UTC の今月、ストレージ（GB）は現在の量 */
  monthly: Record<CloudflareMonthlyKey, SectionState<number>>;
  dayStart: string;
  monthStart: string;
}

// ── 項目ごとの取得状態 ──
// 取れなかったときもパネルの枠は同じまま出し、中身だけこの状態で差し替える

export type SectionState<T> =
  | { status: 'ok'; data: T }
  /** トークンなどが未設定。setting には足りない設定名が入る */
  | { status: 'unconfigured'; setting: string }
  /** 401/403。permission には足りない権限名が入る */
  | { status: 'forbidden'; permission: string; message: string }
  | { status: 'error'; message: string };

export const okData = <T>(s: SectionState<T> | undefined): T | null =>
  s?.status === 'ok' ? s.data : null;

// API トークンの期限（設定ページとダッシュボードの警告に使う）
export interface TokenInfo {
  /** ISO 8601。無期限のトークンなら null */
  expiresAt: string | null;
}

// GitHub・Cloudflare の公式ステータスページ（Atlassian Statuspage）の状態
export type StatusService = 'github' | 'cloudflare';

/** operational 以外の状態 */
export type ComponentStatus =
  | 'degraded_performance'
  | 'partial_outage'
  | 'major_outage'
  | 'under_maintenance';

export interface ServiceIncident {
  id: string;
  /** ステータスページのタイトル（英語のまま） */
  name: string;
  url: string;
}

/** 見ているコンポーネントのうち、正常でないもの */
export interface ServiceIssue {
  component: string;
  status: ComponentStatus;
  /** このコンポーネントに関係する未解決の障害・進行中のメンテナンス */
  incidents: ServiceIncident[];
}

/** 取れなかったときは空（ダッシュボード自体は止めない） */
export type ServiceStatus = Record<StatusService, ServiceIssue[]>;

// GET /api/dashboard
export interface DashboardResponse {
  user: GithubUser;
  github: {
    codespaces: SectionState<Codespace[]>;
    /** Codespaces・Actions の使用量（Billing API） */
    billing: SectionState<BillingUsageSummary>;
    runs: SectionState<WorkflowRun[]>;
    copilot: SectionState<PremiumRequestUsage>;
  };
  cloudflare: {
    builds: SectionState<WorkersBuildsSummary>;
    usage: SectionState<CloudflareUsage>;
  };
  tokens: {
    github: SectionState<TokenInfo>;
    cloudflare: SectionState<TokenInfo>;
  };
  serviceStatus: ServiceStatus;
  notifyAfterMin: number;
  fetchedAt: string;
}

/**
 * GET /api/dashboard の応答。Workers Builds は Preview ごとに API を呼ぶので、
 * 1回の Worker 呼び出しのサブリクエスト上限に収まるよう GET /api/workers-builds に分けている。
 * クライアントで2つをまとめて DashboardResponse にする
 */
export type DashboardApiResponse = Omit<DashboardResponse, 'cloudflare'> & {
  cloudflare: Omit<DashboardResponse['cloudflare'], 'builds'>;
};

// GET /api/workers-builds
export interface WorkersBuildsResponse {
  builds: SectionState<WorkersBuildsSummary>;
}

export interface ApiErrorBody {
  error: string;
}

// GET /api/push/config
export interface PushConfigResponse {
  enabled: boolean;
  publicKey: string | null;
}

export interface PushSubscriptionBody {
  endpoint: string;
  keys: { p256dh: string; auth: string };
}

// Service Worker に届くペイロード
export interface PushPayload {
  title: string;
  body: string;
  url: string;
  tag: string;
  /** アプリアイコンのバッジに出す数（つけっぱなしの台数）。省略時はバッジを変えない */
  badge?: number;
}

// 非GETの /api/* に必須のヘッダー（CSRF対策：カスタムヘッダーはクロスオリジンでは送れない）
export const CSRF_HEADER = 'X-Requested-With';
export const CSRF_VALUE = 'codespacedash';
