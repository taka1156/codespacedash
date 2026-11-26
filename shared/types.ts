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

export type AiProvider = 'copilot' | 'claude';

export const AI_PROVIDERS: readonly AiProvider[] = ['copilot', 'claude'];

export interface ClaudeTokens {
  input: number;
  cacheWrite: number;
  cacheRead: number;
  output: number;
}

export interface ClaudeModelUsage extends ClaudeTokens {
  model: string;
  webSearchRequests: number;
  costUsd: number | null;
}

export interface ClaudeDailyUsage extends ClaudeTokens {
  date: string;
  costUsd: number | null;
}

export interface ClaudeUsage {
  timePeriod: { year: number; month: number };
  models: ClaudeModelUsage[];
  daily: ClaudeDailyUsage[];
  totalCostUsd: number | null;
}

// Actions の実行履歴（最近 push された上位リポジトリから集約）
export interface WorkflowRun {
  id: number;
  repo: string;
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

// GET /api/dashboard
export interface DashboardResponse {
  user: GithubUser;
  codespaces: Codespace[] | null;
  workflowRuns: WorkflowRun[] | null;
  billingSummary: BillingUsageSummary | null;
  aiProvider: AiProvider;
  premiumRequests: PremiumRequestUsage | null;
  claudeUsage: ClaudeUsage | null;
  claudeConfigured: boolean;
  workersBuilds: WorkersBuildsSummary | null;
  workersConfigured: boolean;
  // 取得に失敗したセクションだけメッセージが入る（他のセクションは表示を続ける）
  errors: Partial<
    Record<
      'codespaces' | 'runs' | 'billing' | 'copilot' | 'claude' | 'workers',
      string
    >
  >;
  notifyAfterMin: number;
  fetchedAt: string;
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
