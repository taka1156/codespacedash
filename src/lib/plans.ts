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

export const CLAUDE_PLANS = {
  pro: { label: 'Claude Pro', monthlyUsd: 20, multiplier: 1 },
  max5x: { label: 'Claude Max 5x', monthlyUsd: 100, multiplier: 5 },
  max20x: { label: 'Claude Max 20x', monthlyUsd: 200, multiplier: 20 },
  api: { label: 'API 従量課金', monthlyUsd: null, multiplier: null },
} as const satisfies Record<
  string,
  { label: string; monthlyUsd: number | null; multiplier: number | null }
>;

export const CLAUDE_USAGE_URL = 'https://claude.ai/settings/usage';
export type ClaudePlan = keyof typeof CLAUDE_PLANS;

const keys = <T extends object>(o: T) => Object.keys(o) as (keyof T)[];
export const GITHUB_PLAN_KEYS = keys(GITHUB_PLANS);
export const WORKERS_PLAN_KEYS = keys(WORKERS_PLANS);
export const COPILOT_PLAN_KEYS = keys(COPILOT_PLANS);
export const CLAUDE_PLAN_KEYS = keys(CLAUDE_PLANS);

export const githubPlanFromApi = (
  name: string | null | undefined,
): GithubPlan => (name?.toLowerCase() === 'pro' ? 'pro' : 'free');
