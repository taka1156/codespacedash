// サーバー(Hono)とクライアント(React)で共有するレスポンス型。
// サーバーはGitHub APIの応答からここに定義したフィールドだけを抜き出して返す。

export interface GithubUser {
  login: string;
  name: string | null;
  avatar_url: string;
  html_url: string;
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

// GET /api/dashboard
export interface DashboardResponse {
  user: GithubUser;
  codespaces: Codespace[] | null;
  workflowRuns: WorkflowRun[] | null;
  billingSummary: BillingUsageSummary | null;
  premiumRequests: PremiumRequestUsage | null;
  // 取得に失敗したセクションだけメッセージが入る（他のセクションは表示を続ける）
  errors: Partial<
    Record<'codespaces' | 'runs' | 'billing' | 'copilot', string>
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
}

// 非GETの /api/* に必須のヘッダー（CSRF対策：カスタムヘッダーはクロスオリジンでは送れない）
export const CSRF_HEADER = 'X-Requested-With';
export const CSRF_VALUE = 'codespacedash';
