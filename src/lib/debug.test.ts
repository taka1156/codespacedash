import { describe, expect, it, vi } from 'vitest';
import { EMPTY_DEBUG, type Settings } from '@/hooks/useSettings';
import { codespacesQuota } from './codespacesQuota';
import { applyDebug, applyPullsDebug, resolvePlans } from './debug';
import {
  type BillingUsageItem,
  type DashboardResponse,
  okData,
  type PullsResponse,
} from './types';

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
  github: {
    codespaces: { status: 'ok', data: [] },
    billing: {
      status: 'ok',
      data: { timePeriod: { year: 2026, month: 11 }, usageItems },
    },
    runs: { status: 'ok', data: [] },
    copilot: { status: 'error', message: 'x' },
  },
  cloudflare: {
    builds: { status: 'unconfigured', setting: 'CLOUDFLARE_API_TOKEN' },
    usage: { status: 'unconfigured', setting: 'CLOUDFLARE_API_TOKEN' },
  },
  tokens: {
    github: { status: 'ok', data: { expiresAt: null } },
    cloudflare: { status: 'unconfigured', setting: 'CLOUDFLARE_API_TOKEN' },
  },
  notifyAfterMin: 60,
  fetchedAt: '2026-11-26T00:00:00Z',
});

const settings = (debug: Partial<Settings['debug']>): Settings => ({
  githubPlan: 'auto',
  copilotPlan: 'pro',
  workersPlan: 'auto',
  serviceTab: 'github',
  favorites: [],
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
      codespacesQuota(okData(out?.github.billing))?.usedStorageGbMonth,
    ).toBeCloseTo(12.5);
  });

  it('ストレージだけ上書きしてもコア時間は実値のまま', () => {
    const out = applyDebug(data(real), settings({ codespacesStorageGb: '3' }));
    expect(codespacesQuota(okData(out?.github.billing))?.usedHours).toBe(5);
  });

  it('コア時間だけ上書きしてもストレージは実値のまま', () => {
    const out = applyDebug(data(real), settings({ codespacesHours: '40' }));
    const q = codespacesQuota(okData(out?.github.billing));
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
  const withWorkers = (
    detectedPlan: 'free' | 'paid' | null,
  ): DashboardResponse => ({
    ...data([]),
    cloudflare: {
      usage: { status: 'unconfigured', setting: 'CLOUDFLARE_API_TOKEN' },
      builds: {
        status: 'ok',
        data: {
          builds: [],
          workerCount: 1,
          usedMinutes: 0,
          period: { start: '', end: '' },
          detectedPlan,
          limitReached: false,
        },
      },
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
    expect(okData(out?.cloudflare.builds)?.usedMinutes).toBe(2500);
  });
});

describe('applyDebug（取得状態の上書き）', () => {
  it('権限不足にすると全項目が forbidden になり、権限名が入る', () => {
    const out = applyDebug(data(real), settings({ sectionState: 'forbidden' }));
    expect(out?.github.runs).toMatchObject({
      status: 'forbidden',
      permission: 'Actions: Read',
    });
    expect(out?.cloudflare.builds.status).toBe('forbidden');
    expect(out?.cloudflare.usage).toMatchObject({
      status: 'forbidden',
      permission: 'Account Analytics: Read',
    });
  });

  it('上書きしなければ元の状態のまま', () => {
    const out = applyDebug(data(real), settings({}));
    expect(out?.github.copilot.status).toBe('error');
    expect(out?.cloudflare.builds.status).toBe('unconfigured');
  });
});

describe('resolvePlans（GitHub・Copilot）', () => {
  const off = (p: Partial<Settings> = {}) => {
    const s = { ...settings({}), ...p };
    s.debug = { ...s.debug, enabled: false };
    return s;
  };

  it('自動なら API のプラン名から判定する', () => {
    const d = { ...data([]), user: { ...data([]).user, plan: 'pro' } };
    expect(resolvePlans(off(), d)).toMatchObject({
      github: 'pro',
      githubDetected: 'pro',
      copilot: 'pro',
    });
  });

  it('手動で選んだプランを使う（判定結果は別に返す）', () => {
    expect(
      resolvePlans(off({ githubPlan: 'pro', copilotPlan: 'free' }), data([])),
    ).toMatchObject({ github: 'pro', githubDetected: 'free', copilot: 'free' });
  });

  it('データがなければ Free とみなす', () => {
    expect(resolvePlans(off(), null)).toMatchObject({
      github: 'free',
      workers: 'free',
      workersDetected: 'free',
    });
  });

  it('デバッグのプラン上書きが最優先', () => {
    expect(
      resolvePlans(
        settings({ githubPlan: 'pro', copilotPlan: 'pro_plus' }),
        data([]),
      ),
    ).toMatchObject({ github: 'pro', copilot: 'pro_plus' });
  });
});

describe('applyDebug（数値の入力）', () => {
  it.each(['', '  ', 'abc', '-1', 'Infinity'])(
    '"%s" は未入力扱いで実値のまま',
    (v) => {
      const d = data(real);
      const out = applyDebug(d, settings({ codespacesHours: v }));
      expect(out?.github.billing).toEqual(d.github.billing);
    },
  );

  it('0 は有効な値', () => {
    const out = applyDebug(data(real), settings({ codespacesHours: '0' }));
    expect(codespacesQuota(okData(out?.github.billing))?.usedHours).toBe(0);
  });
});

describe('applyDebug（他製品の項目）', () => {
  it('Codespaces を上書きしても他製品の項目は残す', () => {
    const other = item({
      product: 'actions',
      sku: 'storage',
      unitType: 'GigabyteHours',
    });
    const out = applyDebug(
      data([...real, other]),
      settings({ codespacesHours: '1', codespacesStorageGb: '1' }),
    );
    const items = okData(out?.github.billing)?.usageItems ?? [];
    expect(items).toContainEqual(other);
    expect(items.filter((i) => i.product === 'codespaces')).toHaveLength(2);
  });
});

describe('applyDebug（Actions・Copilot・Workers）', () => {
  const actions = item({
    product: 'actions',
    sku: 'Actions Linux',
    unitType: 'minutes',
    grossAmount: 1,
  });

  it('Actions の分数を Linux の金額にして入れ替える（他の項目は残す）', () => {
    const out = applyDebug(
      data([...real, actions]),
      settings({ actionsMinutes: '500' }),
    );
    const items = okData(out?.github.billing)?.usageItems ?? [];
    const act = items.filter((i) => i.product === 'actions');
    expect(act).toHaveLength(1);
    expect(act[0].grossAmount).toBeCloseTo(3);
    expect(items.filter((i) => i.product === 'codespaces')).toHaveLength(2);
  });

  it('Actions の minutes 以外の項目は消さない', () => {
    const storage = item({ product: 'Actions', unitType: 'GigabyteHours' });
    const out = applyDebug(data([storage]), settings({ actionsMinutes: '1' }));
    expect(okData(out?.github.billing)?.usageItems).toContainEqual(storage);
  });

  it('使用量が取れていなくても疑似値で作る', () => {
    const d = data([]);
    d.github.billing = { status: 'error', message: 'x' };
    const out = applyDebug(d, settings({ actionsMinutes: '10' }));
    expect(okData(out?.github.billing)?.usageItems).toHaveLength(1);
  });

  it('月が分からないときのストレージは 1年の平均で GB-時間にする', () => {
    const d = data([]);
    d.github.billing = {
      status: 'ok',
      data: { timePeriod: { year: 2026 }, usageItems: [] },
    };
    const out = applyDebug(d, settings({ codespacesStorageGb: '2' }));
    expect(
      okData(out?.github.billing)?.usageItems[0].grossQuantity,
    ).toBeCloseTo(2 * 730);
  });

  it('Copilot の金額をモデル別の 7:3 に分ける', () => {
    const out = applyDebug(data([]), settings({ copilotUsd: '10' }));
    const items = okData(out?.github.copilot)?.usageItems ?? [];
    expect(items.map((i) => [i.model, i.grossAmount])).toEqual([
      ['claude-sonnet-5-5', 7],
      ['gpt-5', 3],
    ]);
    expect(items.map((i) => i.grossQuantity)).toEqual([700, 300]);
  });

  it('Workers が未設定でもビルド時間の疑似値でサンプルを出す', () => {
    const out = applyDebug(data([]), settings({ workersMinutes: '100' }));
    const b = okData(out?.cloudflare.builds);
    expect(b?.usedMinutes).toBe(100);
    expect(b?.builds.length).toBeGreaterThan(0);
  });
});

describe('applyDebug（取得状態の上書き：未設定・エラー）', () => {
  it('未設定にすると足りない設定名が入る', () => {
    const out = applyDebug(
      data(real),
      settings({ sectionState: 'unconfigured' }),
    );
    expect(out?.github.codespaces).toEqual({
      status: 'unconfigured',
      setting: 'GITHUB_TOKEN',
    });
    expect(out?.cloudflare.usage).toMatchObject({
      status: 'unconfigured',
      setting: expect.stringContaining('CLOUDFLARE_API_TOKEN'),
    });
  });

  it('エラーにすると全項目が error になる', () => {
    const out = applyDebug(data(real), settings({ sectionState: 'error' }));
    expect(
      [
        ...Object.values(out?.github ?? {}),
        ...Object.values(out?.cloudflare ?? {}),
        ...Object.values(out?.tokens ?? {}),
      ].map((s) => s.status),
    ).toEqual(Array(8).fill('error'));
  });
});

describe('applyDebug（トークンの期限）', () => {
  it('GitHub トークンの期限を今から N 日後にする（Cloudflare はそのまま）', () => {
    vi.useFakeTimers({ now: new Date('2026-11-27T05:00:00Z') });
    const out = applyDebug(data(real), settings({ githubTokenDays: '5' }));
    expect(out?.tokens.github).toEqual({
      status: 'ok',
      data: { expiresAt: '2026-12-02T05:00:00.000Z' },
    });
    expect(out?.tokens.cloudflare.status).toBe('unconfigured');
  });

  it('空欄なら実データのまま', () => {
    const d = data(real);
    expect(applyDebug(d, settings({}))?.tokens).toEqual(d.tokens);
  });

  it('取得状態の上書きはトークンにも効く', () => {
    const out = applyDebug(data(real), settings({ sectionState: 'forbidden' }));
    expect(out?.tokens.github).toMatchObject({
      status: 'forbidden',
      permission: 'トークンの再発行',
    });
  });
});

describe('applyDebug（データがないとき）', () => {
  it('通常のビルドではデータがなければ null のまま', () => {
    expect(applyDebug(null, settings({ codespacesHours: '1' }))).toBeNull();
  });
});

describe('applyPullsDebug', () => {
  const real: PullsResponse = {
    pulls: { status: 'ok', data: [] },
    fetchedAt: '2026-11-26T00:00:00Z',
  };

  it('デバッグがオフなら何もしない', () => {
    const s = { ...settings({}), debug: EMPTY_DEBUG };
    expect(applyPullsDebug(real, s)).toBe(real);
    expect(applyPullsDebug(null, s)).toBeNull();
  });

  it('上書きがなければ実データのまま、データがなければ null のまま', () => {
    expect(applyPullsDebug(real, settings({}))).toBe(real);
    expect(
      applyPullsDebug(null, settings({ sectionState: 'error' })),
    ).toBeNull();
  });

  it('取得状態を上書きする', () => {
    expect(
      applyPullsDebug(real, settings({ sectionState: 'forbidden' }))?.pulls,
    ).toMatchObject({
      status: 'forbidden',
      permission: 'Pull requests: Read（Repository permissions）',
    });
    expect(
      applyPullsDebug(real, settings({ sectionState: 'unconfigured' })),
    ).toEqual({
      ...real,
      pulls: { status: 'unconfigured', setting: 'GITHUB_TOKEN' },
    });
  });
});
