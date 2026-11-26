import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type {
  BillingUsageItem,
  BillingUsageSummary,
  SectionState,
} from '@/lib/types';
import { NOW, run, usageItem } from '@/testing/fixtures';
import { ActionsPanel } from './ActionsPanel';

vi.mock('recharts', () => import('@/testing/rechartsMock'));

const minutes = (sku: string, grossQuantity: number, netAmount = 0) =>
  usageItem({
    product: 'actions',
    sku,
    unitType: 'minutes',
    grossQuantity,
    grossAmount: grossQuantity * 0.006,
    netAmount,
  });

const billing = (
  usageItems: BillingUsageItem[],
  timePeriod: BillingUsageSummary['timePeriod'] = { year: 2026, month: 11 },
): SectionState<BillingUsageSummary> => ({
  status: 'ok',
  data: { timePeriod, usageItems },
});

const panel = (
  b: SectionState<BillingUsageSummary>,
  plan: 'free' | 'pro' = 'free',
) =>
  render(
    <ActionsPanel
      billing={b}
      runs={{ status: 'ok', data: [run()] }}
      plan={plan}
    />,
  );

const gauge = (c: HTMLElement) =>
  JSON.parse(
    c
      .querySelector('[data-chart="RadialBarChart"]')
      ?.getAttribute('data-values') ?? 'null',
  )?.[0];

beforeEach(() => {
  vi.useFakeTimers({ now: NOW, toFake: ['Date'] });
});

describe('ActionsPanel', () => {
  it('Linux 換算の無料枠と、OS 別の分数を出す', () => {
    const { container } = panel(
      billing([
        minutes('actions_linux', 600),
        minutes('Actions macOS', 50),
        // ストレージや他製品は分数に含めない
        usageItem({
          product: 'Actions',
          unitType: 'GigabyteHours',
          grossQuantity: 9,
        }),
        usageItem({
          product: 'codespaces',
          unitType: 'minutes',
          grossQuantity: 9,
        }),
      ]),
    );
    expect(container).toHaveTextContent('2026年11月の実行時間');
    expect(container).toHaveTextContent('650 分');
    // 金額 $3.9 → Linux 換算 650分
    expect(container).toHaveTextContent(
      'GitHub Free の無料枠（Linux換算）使用 650 / 2,000 分 ・ 33%',
    );
    expect(container).toHaveTextContent('合計分数650 分');
    expect(container).toHaveTextContent('請求額（純額）無料枠内');
    expect(container).toHaveTextContent('Linux600 分');
    expect(container).toHaveTextContent('macOS50 分');
    expect(screen.getByText('600 分')).toHaveStyle({
      color: '#f97316',
    });
  });

  it('OS が2つ以上なら内訳のグラフを出し、Tooltip は分で出す', () => {
    const { container } = panel(
      billing([minutes('actions_linux', 10), minutes('actions_windows', 5)]),
    );
    expect(screen.getByText('OS別内訳（分）')).toBeInTheDocument();
    const bars = JSON.parse(
      container
        .querySelector('[data-chart="BarChart"]')
        ?.getAttribute('data-values') ?? '[]',
    );
    expect(bars).toEqual([
      { name: 'Linux', minutes: 10, cost: 0, color: '#f97316' },
      { name: 'Windows', minutes: 5, cost: 0, color: '#38bdf8' },
    ]);
    expect(
      [...container.querySelectorAll('[data-chart="Cell"]')].map((c) =>
        c.getAttribute('data-fill'),
      ),
    ).toEqual(['#f97316', '#38bdf8']);
    expect(container.querySelector('[data-chart="Tooltip"]')).toHaveTextContent(
      '1,234 分',
    );
  });

  it('OS が1つならグラフは出さない', () => {
    panel(billing([minutes('actions_linux', 10)]));
    expect(screen.queryByText('OS別内訳（分）')).toBeNull();
  });

  it('知らない SKU は名前をそのまま出し、色は灰色', () => {
    const { container } = panel(
      billing([minutes('actions_arm', 3), minutes('actions_linux', 1)]),
    );
    expect(screen.getByText('actions_arm')).toBeInTheDocument();
    expect(screen.getByText('3 分')).toHaveStyle({ color: '#94a3b8' });
    expect(
      container.querySelector('[data-chart="Cell"]')?.getAttribute('data-fill'),
    ).toBe('#64748b');
  });

  describe('ゲージ', () => {
    it.each([
      // 請求がなければ無料枠に対する割合
      [[minutes('actions_linux', 400)], 20, '#22d3ee'],
      [[minutes('actions_linux', 1200)], 60, '#f97316'],
      [[minutes('actions_linux', 1800)], 90, '#ef4444'],
      [[minutes('actions_linux', 9000)], 100, '#ef4444'],
      // 請求があれば $5 を満タンとする
      [[minutes('actions_linux', 10, 2)], 40, '#22d3ee'],
      [[minutes('actions_linux', 10, 50)], 100, '#ef4444'],
    ])('%#', (items, value, fill) => {
      const { container } = panel(billing(items));
      expect(gauge(container)).toEqual({ value, fill });
    });

    it('Pro は 3000 分を満タンとする', () => {
      const { container } = panel(
        billing([minutes('actions_linux', 1500)]),
        'pro',
      );
      expect(gauge(container).value).toBe(50);
    });
  });

  it('請求があれば金額をオレンジで出す', () => {
    const { container } = panel(
      billing([minutes('actions_linux', 10, 0.12345)]),
    );
    expect(container).toHaveTextContent('請求額（純額）$0.1235');
  });

  it('月が分からなければ年だけ出す', () => {
    const { container } = panel(billing([], { year: 2026 }));
    expect(container).toHaveTextContent('2026年月の実行時間');
  });

  it('今月の実行がなければその旨を出す', () => {
    const { container } = panel(billing([]));
    expect(container).toHaveTextContent('今月の実行時間はまだありません');
    expect(container).toHaveTextContent('使用 0 / 2,000 分');
    expect(container.querySelector('[data-chart]')).toBeNull();
  });

  it('使用量が取れなければ理由を出す（実行履歴は出す）', () => {
    const { container } = panel({
      status: 'unconfigured',
      setting: 'GITHUB_TOKEN',
    });
    expect(container).toHaveTextContent('未設定 ・ 枠 2,000 分');
    expect(container).toHaveTextContent('実行時間は未設定です');
    expect(container).toHaveTextContent('feat: x');
    expect(container).not.toHaveTextContent('の実行時間');
  });
});
