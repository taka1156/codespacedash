import { render, screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { DashboardResponse } from '@/lib/types';
import { NOW } from '@/testing/fixtures';
import { pillLevel } from './style.css';
import { fmtDateTime, TokensSection } from './TokensSection';

const inDays = (d: number) =>
  new Date(NOW.getTime() + d * 86_400_000).toISOString();
const ok = (expiresAt: string | null) => ({
  status: 'ok' as const,
  data: { expiresAt },
});

const show = (
  github: DashboardResponse['tokens']['github'],
  cloudflare: DashboardResponse['tokens']['cloudflare'] = ok(null),
) => render(<TokensSection tokens={{ github, cloudflare }} />);

const card = (name: string) =>
  screen.getByRole('region', { name: `${name} のトークン` });

beforeEach(() => {
  vi.useFakeTimers({ now: NOW, toFake: ['Date'] });
});

describe('TokensSection', () => {
  it('有効なら期限と残り日数を出し、再発行の案内は出さない', () => {
    show(ok(inDays(40)));
    const gh = card('GitHub');
    expect(gh).toHaveTextContent('GITHUB_TOKEN');
    expect(within(gh).getByText('有効')).toHaveClass(pillLevel.ok);
    expect(gh).toHaveTextContent(
      `期限${fmtDateTime(inDays(40))}（あと 40 日）`,
    );
    expect(within(gh).queryByRole('link')).toBeNull();
  });

  it('期限が近ければ日数と再発行のリンク', () => {
    show(ok(inDays(5)));
    const gh = card('GitHub');
    expect(within(gh).getByText('あと 5 日')).toHaveClass(pillLevel.warn);
    expect(gh).toHaveTextContent(`期限${fmtDateTime(inDays(5))}`);
    expect(gh).not.toHaveTextContent('（あと');
    const link = within(gh).getByRole('link', { name: 'トークンを再発行 ↗' });
    expect(link).toHaveAttribute(
      'href',
      'https://github.com/settings/personal-access-tokens',
    );
    expect(link).toHaveAttribute('target', '_blank');
  });

  it('期限切れ', () => {
    show(ok(null), ok(inDays(-1)));
    const cf = card('Cloudflare');
    expect(within(cf).getByText('期限切れ')).toHaveClass(pillLevel.danger);
    expect(within(cf).getByRole('link')).toHaveAttribute(
      'href',
      'https://dash.cloudflare.com/profile/api-tokens',
    );
  });

  it('無期限', () => {
    show(ok(null));
    const gh = card('GitHub');
    expect(within(gh).getByText('無期限')).toHaveClass(pillLevel.muted);
    expect(gh).toHaveTextContent('期限期限なし');
    expect(within(gh).queryByRole('link')).toBeNull();
  });

  it('未設定・無効・エラーは状態の理由を出す', () => {
    show(
      { status: 'forbidden', permission: 'トークンの再発行', message: 'Bad' },
      { status: 'unconfigured', setting: 'CLOUDFLARE_API_TOKEN' },
    );
    const gh = card('GitHub');
    expect(within(gh).getByText('無効')).toHaveClass(pillLevel.danger);
    expect(gh).toHaveTextContent('状態Bad');
    expect(within(gh).getByRole('link')).toBeInTheDocument();

    const cf = card('Cloudflare');
    expect(within(cf).getByText('未設定')).toHaveClass(pillLevel.muted);
    expect(cf).toHaveTextContent('CLOUDFLARE_API_TOKEN が未設定です');
    expect(within(cf).queryByRole('link')).toBeNull();
  });

  it('取得エラー', () => {
    show({ status: 'error', message: 'boom' });
    const gh = card('GitHub');
    expect(within(gh).getByText('取得エラー')).toHaveClass(pillLevel.danger);
    expect(gh).toHaveTextContent('状態boom');
    expect(within(gh).queryByRole('link')).toBeNull();
  });

  it('取得前は読み込み中', () => {
    render(<TokensSection tokens={null} />);
    expect(screen.getByText('読み込み中…')).toBeInTheDocument();
    expect(screen.queryByRole('region')).toBeNull();
    expect(screen.getByText(/14 日前から/)).toBeInTheDocument();
  });
});
