import type { Settings } from '@/hooks/useSettings';
import {
  type CopilotPlan,
  type GithubPlan,
  githubPlanFromApi,
  type WorkersPlan,
} from './plans';
import { asset, IS_STATIC_PREVIEW } from './preview';
import {
  type BillingUsageItem,
  type CloudflareUsage,
  type Codespace,
  type DashboardResponse,
  okData,
  type PremiumRequestUsage,
  type SectionState,
  type WorkerBuild,
  type WorkersBuildsSummary,
  type WorkflowRun,
} from './types';

export interface ResolvedPlans {
  github: GithubPlan;
  githubDetected: GithubPlan;
  copilot: CopilotPlan;
  workers: WorkersPlan;
  workersDetected: WorkersPlan;
}

export const resolvePlans = (
  settings: Settings,
  data: DashboardResponse | null,
): ResolvedPlans => {
  const d = settings.debug.enabled ? settings.debug : null;
  const detected = okData(data?.cloudflare.builds)?.detectedPlan ?? 'free';
  return {
    github:
      d?.githubPlan ||
      (settings.githubPlan === 'auto'
        ? githubPlanFromApi(data?.user.plan)
        : settings.githubPlan),
    githubDetected: githubPlanFromApi(data?.user.plan),
    copilot: d?.copilotPlan || settings.copilotPlan,
    workers:
      d?.workersPlan ||
      (settings.workersPlan === 'auto' ? detected : settings.workersPlan),
    workersDetected: detected,
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
    // 切り替えタブの確認用に api-server だけ private にする
    private: repo === 'example/api-server',
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

const MOCK_ACCOUNT = '0123456789abcdef';

const mockBuilds = (): WorkerBuild[] =>
  (
    [
      ['codespacedash', 'running', null, 'feat: Workers Builds タブ', 2, 0],
      ['codespacedash', 'stopped', 'success', 'fix: 通知の文言', 45, 2],
      ['blog', 'stopped', 'fail', 'chore: bump astro', 130, 3],
      ['api-gateway', 'stopped', 'success', 'release v2.1.0', 60 * 7, 1],
      ['blog', 'stopped', 'cancelled', 'docs: typo', 60 * 26, 1],
      ['api-gateway', 'stopped', 'success', 'feat: rate limit', 60 * 50, 2],
    ] as const
  ).map(([worker, status, outcome, msg, minAgo, dur], i) => ({
    id: `00000000-0000-4000-8000-00000000000${i}`,
    worker,
    status,
    outcome,
    branch: i === 4 ? 'docs/typo' : 'main',
    commitHash: `${(0xabc1234 + i * 977).toString(16)}0000000`,
    commitMessage: msg,
    source: i === 4 ? 'pull_request' : 'push',
    repo: `example/${worker}`,
    createdAt: ago(minAgo),
    startedAt: ago(minAgo),
    stoppedAt: status === 'stopped' ? ago(minAgo - dur) : null,
    dashboardUrl: `https://dash.cloudflare.com/${MOCK_ACCOUNT}/workers`,
  }));

const mockWorkers = (minutes: number): WorkersBuildsSummary => {
  const d = new Date();
  return {
    builds: mockBuilds(),
    workerCount: 3,
    usedMinutes: minutes,
    period: {
      start: new Date(d.getFullYear(), d.getMonth(), 1).toISOString(),
      end: new Date(d.getFullYear(), d.getMonth() + 1, 1).toISOString(),
    },
    detectedPlan: 'free',
    limitReached: false,
  };
};

const ok = <T>(data: T) => ({ status: 'ok' as const, data });

const mockUsage = (): CloudflareUsage => {
  const d = new Date();
  return {
    daily: {
      workersRequests: ok(18_400),
      workersAiNeurons: ok(8_650),
      d1RowsRead: ok(1_240_000),
      d1RowsWritten: ok(3_200),
      kvReads: ok(9_800),
      kvWrites: ok(140),
      kvDeletes: ok(35),
      kvLists: ok(620),
    },
    monthly: {
      r2StorageGb: ok(3.2),
      r2ClassA: ok(42_000),
      r2ClassB: ok(610_000),
      d1StorageGb: ok(0.04),
      kvStorageGb: ok(0.12),
    },
    dayStart: new Date(
      Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()),
    ).toISOString(),
    monthStart: new Date(
      Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1),
    ).toISOString(),
  };
};

const mockBase = (): DashboardResponse => ({
  user: {
    login: 'preview-user',
    name: 'Preview',
    avatar_url: asset('icons/icon-192.png'),
    html_url: 'https://github.com',
    plan: 'free',
  },
  github: {
    codespaces: ok(mockCodespaces()),
    billing: ok({ timePeriod: now(), usageItems: [] }),
    runs: ok(mockRuns()),
    copilot: ok({ timePeriod: now(), usageItems: [] }),
  },
  cloudflare: {
    builds: ok(mockWorkers(0)),
    usage: ok(mockUsage()),
  },
  notifyAfterMin: 60,
  fetchedAt: new Date().toISOString(),
});

const LINUX_USD_PER_MIN = 0.006;

const isCsStorage = (i: BillingUsageItem) => /storage/i.test(i.sku);

export const applyDebug = (
  data: DashboardResponse | null,
  settings: Settings,
): DashboardResponse | null => {
  const d = settings.debug;
  if (!d.enabled) {
    return data;
  }
  const base = data ?? (IS_STATIC_PREVIEW ? mockBase() : null);
  if (!base) {
    return null;
  }
  const out: DashboardResponse = {
    ...base,
    github: { ...base.github },
    cloudflare: { ...base.cloudflare },
  };

  const csHours = num(d.codespacesHours);
  const csStorage = num(d.codespacesStorageGb);
  const actMin = num(d.actionsMinutes);
  if (csHours !== null || csStorage !== null || actMin !== null) {
    const summary = okData(out.github.billing) ?? {
      timePeriod: now(),
      usageItems: [],
    };
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
    out.github.billing = ok({ ...summary, usageItems: items });
  }

  const wkMin = num(d.workersMinutes);
  if (wkMin !== null) {
    out.cloudflare.builds = ok({
      ...(okData(out.cloudflare.builds) ?? mockWorkers(0)),
      usedMinutes: wkMin,
    });
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
    out.github.copilot = ok(p);
  }

  if (d.sectionState) {
    const fake = (setting: string, permission: string): SectionState<never> =>
      d.sectionState === 'unconfigured'
        ? { status: 'unconfigured', setting }
        : d.sectionState === 'forbidden'
          ? {
              status: 'forbidden',
              permission,
              message:
                'API 403: Resource not accessible（デバッグの疑似エラー）',
            }
          : { status: 'error', message: 'API 500（デバッグの疑似エラー）' };
    out.github = {
      codespaces: fake('GITHUB_TOKEN', 'Codespaces: Read'),
      billing: fake('GITHUB_TOKEN', 'Plan: Read'),
      runs: fake('GITHUB_TOKEN', 'Actions: Read'),
      copilot: fake('GITHUB_TOKEN', 'Plan: Read'),
    };
    const cf = 'CLOUDFLARE_API_TOKEN と CLOUDFLARE_ACCOUNT_ID';
    out.cloudflare = {
      builds: fake(cf, 'Workers Builds Configuration: Read'),
      usage: fake(cf, 'Account Analytics: Read'),
    };
  }

  return out;
};
