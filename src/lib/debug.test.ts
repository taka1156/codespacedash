import { describe, expect, it } from 'vitest';
import { EMPTY_DEBUG, type Settings } from '@/hooks/useSettings';
import { codespacesQuota } from './codespacesQuota';
import { applyDebug, resolvePlans } from './debug';
import type { BillingUsageItem, DashboardResponse } from './types';

const item = (p: Partial<BillingUsageItem>): BillingUsageItem => ({
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

const data = (usageItems: BillingUsageItem[]): DashboardResponse => ({
  user: {
    login: 'u',
    name: null,
    avatar_url: '',
    html_url: '',
    plan: 'free',
  },
  codespaces: [],
  workflowRuns: [],
  billingSummary: { timePeriod: { year: 2026, month: 11 }, usageItems },
  aiProvider: 'copilot',
  premiumRequests: null,
  claudeUsage: null,
  claudeConfigured: false,
  workersBuilds: null,
  workersConfigured: false,
  errors: {},
  notifyAfterMin: 60,
  fetchedAt: '2026-11-26T00:00:00Z',
});

const settings = (debug: Partial<Settings['debug']>): Settings => ({
  aiProvider: 'copilot',
  githubPlan: 'auto',
  copilotPlan: 'pro',
  claudePlan: 'pro',
  workersPlan: 'auto',
  buildsTab: 'actions',
  debug: { ...EMPTY_DEBUG, enabled: true, ...debug },
});

const real = [
  item({ sku: 'codespaces_compute_d2', unitType: 'hours', grossQuantity: 5 }),
  item({
    sku: 'codespaces_storage',
    unitType: 'GigabyteHours',
    grossQuantity: 720,
  }),
];

describe('applyDebug（Codespaces ストレージ）', () => {
  it('ストレージの疑似値が GB-月のまま表示される', () => {
    const out = applyDebug(
      data(real),
      settings({ codespacesStorageGb: '12.5' }),
    );
    expect(
      codespacesQuota(out?.billingSummary ?? null)?.usedStorageGbMonth,
    ).toBeCloseTo(12.5);
  });

  it('ストレージだけ上書きしてもコア時間は実値のまま', () => {
    const out = applyDebug(data(real), settings({ codespacesStorageGb: '3' }));
    expect(codespacesQuota(out?.billingSummary ?? null)?.usedHours).toBe(5);
  });

  it('コア時間だけ上書きしてもストレージは実値のまま', () => {
    const out = applyDebug(data(real), settings({ codespacesHours: '40' }));
    const q = codespacesQuota(out?.billingSummary ?? null);
    expect(q?.usedHours).toBe(40);
    expect(q?.usedStorageGbMonth).toBeCloseTo(1);
  });

  it('デバッグが無効なら何も変えない', () => {
    const d = data(real);
    const s = settings({ codespacesStorageGb: '99' });
    s.debug.enabled = false;
    expect(applyDebug(d, s)).toBe(d);
  });
});

describe('resolvePlans（Workers）', () => {
  const withWorkers = (detectedPlan: 'free' | 'paid' | null) => ({
    ...data([]),
    workersBuilds: {
      builds: [],
      workerCount: 1,
      usedMinutes: 0,
      period: { start: '', end: '' },
      detectedPlan,
      limitReached: false,
    },
  });

  it('自動なら API から推定したプランを使う', () => {
    const s = settings({});
    s.debug.enabled = false;
    expect(resolvePlans(s, withWorkers('paid')).workers).toBe('paid');
  });

  it('推定できなければ Free 扱い', () => {
    const s = settings({});
    s.debug.enabled = false;
    expect(resolvePlans(s, withWorkers(null)).workers).toBe('free');
  });

  it('手動で選んだプランが優先される', () => {
    const s = { ...settings({}), workersPlan: 'paid' as const };
    s.debug.enabled = false;
    expect(resolvePlans(s, withWorkers('free')).workers).toBe('paid');
  });

  it('デバッグのプラン上書きが最優先', () => {
    const s = {
      ...settings({ workersPlan: 'free' }),
      workersPlan: 'paid' as const,
    };
    expect(resolvePlans(s, withWorkers('paid')).workers).toBe('free');
  });

  it('ビルド時間の疑似値で使用量を上書きする', () => {
    const out = applyDebug(
      withWorkers('free'),
      settings({ workersMinutes: '2500' }),
    );
    expect(out?.workersBuilds?.usedMinutes).toBe(2500);
  });
});
