export const GITHUB_PLANS = {
  free: {
    label: 'GitHub Free',
    codespacesCoreHours: 120,
    /** Codespaces ストレージの無料枠（GB-月）。停止中の Codespace とプレビルドも含む */
    codespacesStorageGbMonth: 15,
    actionsMinutes: 2000,
  },
  pro: {
    label: 'GitHub Pro',
    codespacesCoreHours: 180,
    codespacesStorageGbMonth: 20,
    actionsMinutes: 3000,
  },
} as const;
export type GithubPlan = keyof typeof GITHUB_PLANS;

/** Cloudflare Workers Builds のビルド時間（分/月） */
export const WORKERS_PLANS = {
  free: { label: 'Workers Free', buildMinutes: 3000 },
  paid: { label: 'Workers Paid', buildMinutes: 6000 },
} as const;
export type WorkersPlan = keyof typeof WORKERS_PLANS;

export const COPILOT_PLANS = {
  free: { label: 'Copilot Free', includedUsd: null },
  pro: { label: 'Copilot Pro', includedUsd: 10 },
  pro_plus: { label: 'Copilot Pro+', includedUsd: 39 },
} as const satisfies Record<
  string,
  { label: string; includedUsd: number | null }
>;
export type CopilotPlan = keyof typeof COPILOT_PLANS;

/**
 * Cloudflare の無料枠（Workers Free）。日次はすべて 00:00 UTC にリセット
 * https://developers.cloudflare.com/workers/platform/pricing/
 */
export const CLOUDFLARE_DAILY_FREE = [
  {
    key: 'workersRequests',
    label: 'Workers リクエスト',
    free: 100_000,
    unit: '回',
  },
  {
    key: 'workersAiNeurons',
    label: 'Workers AI',
    free: 10_000,
    unit: 'Neurons',
  },
  { key: 'd1RowsRead', label: 'D1 読み取り', free: 5_000_000, unit: '行' },
  { key: 'd1RowsWritten', label: 'D1 書き込み', free: 100_000, unit: '行' },
  { key: 'kvReads', label: 'KV 読み取り', free: 100_000, unit: '回' },
  { key: 'kvWrites', label: 'KV 書き込み', free: 1_000, unit: '回' },
] as const;

/** 月次（R2）と総量（D1 ストレージ）の無料枠 */
export const CLOUDFLARE_STORAGE_FREE = [
  { key: 'r2StorageGb', label: 'R2 ストレージ', free: 10, unit: 'GB-月' },
  { key: 'r2ClassA', label: 'R2 Class A 操作', free: 1_000_000, unit: '回' },
  { key: 'r2ClassB', label: 'R2 Class B 操作', free: 10_000_000, unit: '回' },
  { key: 'd1StorageGb', label: 'D1 ストレージ', free: 5, unit: 'GB' },
] as const;

const keys = <T extends object>(o: T) => Object.keys(o) as (keyof T)[];
export const GITHUB_PLAN_KEYS = keys(GITHUB_PLANS);
export const WORKERS_PLAN_KEYS = keys(WORKERS_PLANS);
export const COPILOT_PLAN_KEYS = keys(COPILOT_PLANS);

export const githubPlanFromApi = (
  name: string | null | undefined,
): GithubPlan => (name?.toLowerCase() === 'pro' ? 'pro' : 'free');
