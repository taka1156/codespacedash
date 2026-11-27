import type {
  BillingUsageItem,
  Codespace,
  DashboardResponse,
  PremiumRequestItem,
  WorkerBuild,
  WorkersBuildsSummary,
  WorkflowRun,
} from '@/lib/types';

/** テストの「今」。各テストは vi.setSystemTime(NOW) で固定する */
export const NOW = new Date('2026-11-27T05:00:00Z');

export const ago = (min: number) =>
  new Date(NOW.getTime() - min * 60_000).toISOString();

export const usageItem = (p: Partial<BillingUsageItem>): BillingUsageItem => ({
  product: 'codespaces',
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

export const premiumItem = (
  p: Partial<PremiumRequestItem>,
): PremiumRequestItem => ({
  ...usageItem({ product: 'copilot', unitType: 'ai-credits' }),
  model: 'gpt-5',
  ...p,
});

export const codespace = (p: Partial<Codespace> = {}): Codespace => ({
  id: 1,
  name: 'cs-1',
  display_name: 'CS 1',
  state: 'Available',
  machine: {
    name: 'basicLinux32gb',
    display_name: '2 cores',
    cpus: 2,
    memory_in_bytes: 8 * 1024 ** 3,
    storage_in_bytes: 32 * 1024 ** 3,
  },
  repository: { full_name: 'me/app', html_url: 'https://github.com/me/app' },
  created_at: ago(600),
  last_used_at: ago(10),
  location: 'EastUs',
  retention_expires_at: null,
  idle_timeout_minutes: 30,
  web_url: 'https://github.com/codespaces/cs-1',
  has_unpushed_changes: false,
  ...p,
});

export const run = (p: Partial<WorkflowRun> = {}): WorkflowRun => ({
  id: 1,
  repo: 'me/app',
  private: false,
  workflowName: 'CI',
  title: 'feat: x',
  branch: 'main',
  event: 'push',
  status: 'completed',
  conclusion: 'success',
  runNumber: 7,
  createdAt: ago(10),
  startedAt: ago(10),
  updatedAt: ago(8),
  htmlUrl: 'https://github.com/me/app/actions/runs/1',
  ...p,
});

export const build = (p: Partial<WorkerBuild> = {}): WorkerBuild => ({
  id: 'b1',
  worker: 'site',
  status: 'stopped',
  outcome: 'success',
  branch: 'main',
  commitHash: 'abcdef1234567',
  commitMessage: 'feat: y',
  source: 'push',
  repo: 'me/site',
  createdAt: ago(30),
  startedAt: ago(30),
  stoppedAt: ago(28),
  dashboardUrl: 'https://dash.cloudflare.com/b1',
  ...p,
});

export const buildsSummary = (
  p: Partial<WorkersBuildsSummary> = {},
): WorkersBuildsSummary => ({
  builds: [build()],
  workerCount: 1,
  usedMinutes: 120,
  period: {
    start: '2026-11-01T00:00:00+09:00',
    end: '2026-12-01T00:00:00+09:00',
  },
  detectedPlan: 'free',
  limitReached: false,
  ...p,
});

const ok = <T>(data: T) => ({ status: 'ok' as const, data });

export const dashboard = (
  p: {
    github?: Partial<DashboardResponse['github']>;
    cloudflare?: Partial<DashboardResponse['cloudflare']>;
  } & Partial<Omit<DashboardResponse, 'github' | 'cloudflare'>> = {},
): DashboardResponse => {
  const { github, cloudflare, ...rest } = p;
  return {
    user: {
      login: 'me',
      name: 'Me',
      avatar_url: 'https://avatars.example.com/me',
      html_url: 'https://github.com/me',
      plan: 'free',
    },
    github: {
      codespaces: ok([codespace()]),
      billing: ok({ timePeriod: { year: 2026, month: 11 }, usageItems: [] }),
      runs: ok([run()]),
      copilot: ok({ timePeriod: { year: 2026, month: 11 }, usageItems: [] }),
      ...github,
    },
    cloudflare: {
      builds: ok(buildsSummary()),
      usage: { status: 'unconfigured', setting: 'CLOUDFLARE_API_TOKEN' },
      ...cloudflare,
    },
    notifyAfterMin: 60,
    fetchedAt: NOW.toISOString(),
    ...rest,
  };
};
