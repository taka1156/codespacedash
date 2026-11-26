import type { Settings } from '@/hooks/useSettings';
import {
  type ClaudePlan,
  type CopilotPlan,
  type GithubPlan,
  githubPlanFromApi,
} from './plans';
import { asset, IS_STATIC_PREVIEW } from './preview';
import type {
  BillingUsageItem,
  ClaudeUsage,
  Codespace,
  DashboardResponse,
  PremiumRequestUsage,
  WorkflowRun,
} from './types';

export interface ResolvedPlans {
  github: GithubPlan;
  githubDetected: GithubPlan;
  copilot: CopilotPlan;
  claude: ClaudePlan;
}

export const resolvePlans = (
  settings: Settings,
  data: DashboardResponse | null,
): ResolvedPlans => {
  const d = settings.debug.enabled ? settings.debug : null;
  return {
    github:
      d?.githubPlan ||
      (settings.githubPlan === 'auto'
        ? githubPlanFromApi(data?.user.plan)
        : settings.githubPlan),
    githubDetected: githubPlanFromApi(data?.user.plan),
    copilot: d?.copilotPlan || settings.copilotPlan,
    claude: d?.claudePlan || settings.claudePlan,
  };
};

const num = (v: string) => {
  if (v.trim() === '') {
    return null;
  }
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 ? n : null;
};

const item = (p: Partial<BillingUsageItem>): BillingUsageItem => ({
  product: '',
  sku: '',
  unitType: '',
  pricePerUnit: 0,
  grossQuantity: 0,
  grossAmount: 0,
  discountQuantity: 0,
  discountAmount: 0,
  netQuantity: 0,
  netAmount: 0,
  ...p,
});

const now = () => {
  const d = new Date();
  return { year: d.getFullYear(), month: d.getMonth() + 1 };
};

const ago = (min: number) => new Date(Date.now() - min * 60_000).toISOString();

const machine = (cores: number) => ({
  name: `basicLinux${cores}core`,
  display_name: `${cores} cores, ${cores * 4} GB RAM, 32 GB storage`,
  cpus: cores,
  memory_in_bytes: cores * 4 * 1024 ** 3,
  storage_in_bytes: 32 * 1024 ** 3,
});

const mockCodespaces = (): Codespace[] =>
  [
    {
      name: 'web-app-x7k2',
      repo: 'example/web-app',
      state: 'Available',
      used: 95,
      cores: 4,
      dirty: true,
    },
    {
      name: 'api-server-p9q1',
      repo: 'example/api-server',
      state: 'Available',
      used: 8,
      cores: 2,
      dirty: false,
    },
    {
      name: 'docs-site-m3n8',
      repo: 'example/docs-site',
      state: 'Shutdown',
      used: 60 * 26,
      cores: 2,
      dirty: false,
    },
  ].map((c, i) => ({
    id: i + 1,
    name: c.name,
    display_name: c.name.replace(/-[a-z0-9]{4}$/, ''),
    state: c.state,
    machine: machine(c.cores),
    repository: { full_name: c.repo, html_url: 'https://github.com' },
    created_at: ago(60 * 24 * 5),
    last_used_at: ago(c.used),
    location: 'SouthEastAsia',
    retention_expires_at: null,
    idle_timeout_minutes: 30,
    web_url: 'https://github.com/codespaces',
    has_unpushed_changes: c.dirty,
  }));

const mockRuns = (): WorkflowRun[] =>
  (
    [
      ['example/web-app', 'CI', 'feat: add settings', 'in_progress', null, 3],
      ['example/web-app', 'CI', 'fix: typo', 'completed', 'success', 40],
      [
        'example/api-server',
        'Deploy',
        'release v1.4.0',
        'completed',
        'success',
        180,
      ],
      [
        'example/api-server',
        'CI',
        'chore: bump deps',
        'completed',
        'failure',
        300,
      ],
      [
        'example/docs-site',
        'Pages',
        'docs: update',
        'completed',
        'cancelled',
        900,
      ],
    ] as const
  ).map(([repo, wf, title, status, conclusion, min], i) => ({
    id: 1000 + i,
    repo,
    workflowName: wf,
    title,
    branch: 'main',
    event: 'push',
    status,
    conclusion,
    runNumber: 120 - i,
    createdAt: ago(min),
    startedAt: ago(min),
    updatedAt: ago(Math.max(0, min - 2)),
    htmlUrl: 'https://github.com',
  }));

const mockBase = (
  aiProvider: DashboardResponse['aiProvider'],
): DashboardResponse => ({
  user: {
    login: 'preview-user',
    name: 'Preview',
    avatar_url: asset('icons/icon-192.png'),
    html_url: 'https://github.com',
    plan: 'free',
  },
  codespaces: mockCodespaces(),
  workflowRuns: mockRuns(),
  billingSummary: { timePeriod: now(), usageItems: [] },
  aiProvider,
  premiumRequests: { timePeriod: now(), usageItems: [] },
  claudeUsage: mockClaude(0, 0),
  claudeConfigured: true,
  errors: {},
  notifyAfterMin: 60,
  fetchedAt: new Date().toISOString(),
});

const LINUX_USD_PER_MIN = 0.006;

const isCsStorage = (i: BillingUsageItem) => /storage/i.test(i.sku);

const mockClaude = (usd: number, tokensM: number): ClaudeUsage => {
  const { year, month } = now();
  const today = new Date().getDate();
  const total = tokensM * 1e6;
  const split = (t: number) => ({
    input: Math.round(t * 0.06),
    cacheWrite: Math.round(t * 0.1),
    cacheRead: Math.round(t * 0.8),
    output: Math.round(t * 0.04),
  });
  const weights = Array.from(
    { length: today },
    (_, i) => 0.4 + Math.abs(Math.sin(i * 1.7)),
  );
  const wSum = weights.reduce((a, b) => a + b, 0);
  return {
    timePeriod: { year, month },
    models: [
      {
        model: 'claude-opus-5-5',
        ...split(total * 0.35),
        webSearchRequests: 12,
        costUsd: usd * 0.7,
      },
      {
        model: 'claude-sonnet-5-5',
        ...split(total * 0.65),
        webSearchRequests: 0,
        costUsd: usd * 0.3,
      },
    ],
    daily: weights.map((w, i) => ({
      date: `${year}-${String(month).padStart(2, '0')}-${String(i + 1).padStart(2, '0')}`,
      ...split((total * w) / wSum),
      costUsd: (usd * w) / wSum,
    })),
    totalCostUsd: usd,
  };
};

export const applyDebug = (
  data: DashboardResponse | null,
  settings: Settings,
): DashboardResponse | null => {
  const d = settings.debug;
  if (!d.enabled) {
    return data;
  }
  const base =
    data ?? (IS_STATIC_PREVIEW ? mockBase(settings.aiProvider) : null);
  if (!base) {
    return null;
  }
  const out: DashboardResponse = {
    ...base,
    aiProvider: data?.aiProvider ?? settings.aiProvider,
    errors: { ...base.errors },
  };

  const csHours = num(d.codespacesHours);
  const csStorage = num(d.codespacesStorageGb);
  const actMin = num(d.actionsMinutes);
  if (csHours !== null || csStorage !== null || actMin !== null) {
    const summary = out.billingSummary ?? { timePeriod: now(), usageItems: [] };
    let items = summary.usageItems;
    if (csHours !== null) {
      items = [
        ...items.filter(
          (i) => !(/codespaces/i.test(i.product) && !isCsStorage(i)),
        ),
        item({
          product: 'codespaces',
          sku: 'codespaces_compute_d2',
          unitType: 'hours',
          grossQuantity: csHours,
        }),
      ];
    }
    if (csStorage !== null) {
      // 実際の API と同じく GB-時間 で入れる（表示側で GB-月 に換算される）
      const { year, month } = summary.timePeriod;
      const hours = month
        ? new Date(year, month, 0).getDate() * 24
        : (365 * 24) / 12;
      items = [
        ...items.filter(
          (i) => !(/codespaces/i.test(i.product) && isCsStorage(i)),
        ),
        item({
          product: 'codespaces',
          sku: 'codespaces_storage',
          unitType: 'GigabyteHours',
          grossQuantity: csStorage * hours,
        }),
      ];
    }
    if (actMin !== null) {
      items = [
        ...items.filter(
          (i) =>
            !(
              i.product.toLowerCase() === 'actions' && i.unitType === 'minutes'
            ),
        ),
        item({
          product: 'actions',
          sku: 'Actions Linux',
          unitType: 'minutes',
          pricePerUnit: LINUX_USD_PER_MIN,
          grossQuantity: actMin,
          grossAmount: actMin * LINUX_USD_PER_MIN,
        }),
      ];
    }
    out.billingSummary = { ...summary, usageItems: items };
  }

  const cpUsd = num(d.copilotUsd);
  if (cpUsd !== null) {
    const p: PremiumRequestUsage = {
      timePeriod: now(),
      usageItems: [
        {
          ...item({
            product: 'copilot',
            unitType: 'ai-credits',
            grossQuantity: Math.round(cpUsd * 70),
            grossAmount: cpUsd * 0.7,
          }),
          model: 'claude-sonnet-5-5',
        },
        {
          ...item({
            product: 'copilot',
            unitType: 'ai-credits',
            grossQuantity: Math.round(cpUsd * 30),
            grossAmount: cpUsd * 0.3,
          }),
          model: 'gpt-5',
        },
      ],
    };
    out.premiumRequests = p;
    delete out.errors.copilot;
  }

  const clUsd = num(d.claudeUsd);
  const clTok = num(d.claudeTokensM);
  if (clUsd !== null || clTok !== null) {
    out.claudeUsage = mockClaude(clUsd ?? 0, clTok ?? 0);
    out.claudeConfigured = true;
    delete out.errors.claude;
  }

  return out;
};
