import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { CopilotPlan } from '@/lib/plans';
import type {
  PremiumRequestItem,
  PremiumRequestUsage,
  SectionState,
} from '@/lib/types';
import { premiumItem } from '@/testing/fixtures';
import { CopilotPanel } from './CopilotPanel';

vi.mock('recharts', () => import('@/testing/rechartsMock'));

const ok = (
  usageItems: PremiumRequestItem[],
): SectionState<PremiumRequestUsage> => ({
  status: 'ok',
  data: { timePeriod: { year: 2026, month: 11 }, usageItems },
});

const panel = (
  s: SectionState<PremiumRequestUsage>,
  plan: CopilotPlan = 'pro',
) => render(<CopilotPanel premiumRequests={s} plan={plan} />);

describe('CopilotPanel', () => {
  it('モデル別のリクエスト数と AI Credits の使用額を出す', () => {
    const { container } = panel(
      ok([
        premiumItem({ model: 'claude', grossQuantity: 1200, grossAmount: 6 }),
        premiumItem({ model: 'gpt-5', grossQuantity: 300, grossAmount: 1.5 }),
      ]),
    );
    expect(container).toHaveTextContent('Copilot Pro');
    expect(container).toHaveTextContent(
      'Copilot Pro の AI Credits使用 7.5 / 10 USD ・ 75%',
    );
    expect(container).toHaveTextContent('プレミアムリクエスト合計1,500 回');
    expect(container).toHaveTextContent('請求額（純額）無料枠内');
    expect(container).toHaveTextContent('使用モデル数2 モデル');
    expect(container).toHaveTextContent('claude1,200');
    expect(container).toHaveTextContent('gpt-5300');
    expect(screen.getByText('モデル別リクエスト数')).toBeInTheDocument();
    expect(container.querySelector('[data-chart="Tooltip"]')).toHaveTextContent(
      '1,234 回',
    );
  });

  it('モデルの色は6色で回す', () => {
    const { container } = panel(
      ok(
        Array.from({ length: 7 }, (_, i) =>
          premiumItem({ model: `m${i}`, grossQuantity: 1 }),
        ),
      ),
    );
    const fills = [...container.querySelectorAll('[data-chart="Cell"]')].map(
      (c) => c.getAttribute('data-fill'),
    );
    expect(fills).toHaveLength(7);
    expect(fills[6]).toBe(fills[0]);
    expect(new Set(fills).size).toBe(6);
  });

  it('1モデルだけならグラフは出さない', () => {
    panel(ok([premiumItem({ grossQuantity: 1 })]));
    expect(screen.queryByText('モデル別リクエスト数')).toBeNull();
  });

  it('超過の請求があれば金額を出す', () => {
    const { container } = panel(
      ok([premiumItem({ grossQuantity: 1, netAmount: 0.04 })]),
    );
    expect(container).toHaveTextContent('請求額（純額）$0.0400');
  });

  it('Pro+ は 39 USD の枠', () => {
    const { container } = panel(
      ok([premiumItem({ grossAmount: 3.9 })]),
      'pro_plus',
    );
    expect(container).toHaveTextContent('使用 3.9 / 39 USD ・ 10%');
  });

  it('Free は AI Credits の枠を出さない', () => {
    const { container } = panel(
      ok([premiumItem({ grossQuantity: 5 })]),
      'free',
    );
    expect(container).toHaveTextContent('Copilot Free');
    expect(container).not.toHaveTextContent('AI Credits');
  });

  it('今月まだ使っていなければその旨を出す', () => {
    const { container } = panel(ok([]));
    expect(container).toHaveTextContent('今月はまだ使われていません');
    expect(container).toHaveTextContent('使用 0 / 10 USD');
  });

  it('取れなければ理由を出す', () => {
    const { container } = panel({ status: 'error', message: 'boom' });
    expect(container).toHaveTextContent('取得失敗 ・ 枠 10 USD');
    expect(container).toHaveTextContent(
      'プレミアムリクエストを取得できませんでした',
    );
  });

  it('Free で取れなければ理由だけ出す', () => {
    const { container } = panel({ status: 'error', message: 'boom' }, 'free');
    expect(container).not.toHaveTextContent('枠');
    expect(container).toHaveTextContent('boom');
  });
});
