import { fireEvent, render, screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useDashboard } from '@/hooks/useDashboard';
import { usePush } from '@/hooks/usePush';
import type { DashboardResponse } from '@/lib/types';
import { build, buildsSummary, dashboard, NOW, run } from '@/testing/fixtures';
import { setPreview } from '@/testing/previewMock';
import { DashboardPage } from './DashboardPage';

vi.mock('recharts', () => import('@/testing/rechartsMock'));
vi.mock('@/lib/preview', () =>
  import('@/testing/previewMock').then((m) => m.previewModule),
);
vi.mock('@/hooks/useDashboard', () => ({ useDashboard: vi.fn() }));
vi.mock('@/hooks/usePush', () => ({ usePush: vi.fn() }));

const fetchAll = vi.fn();
const stopCodespace = vi.fn(async () => {});

const mockDashboard = (p: Partial<ReturnType<typeof useDashboard>> = {}) =>
  vi.mocked(useDashboard).mockReturnValue({
    data: dashboard(),
    loading: false,
    error: null,
    sessionExpired: false,
    lastFetched: NOW,
    fetchAll,
    stopCodespace,
    ...p,
  });

const tab = (name: RegExp) => screen.getByRole('tab', { name });
const headings = () =>
  screen.getAllByRole('heading', { level: 2 }).map((h) => h.textContent);

beforeEach(() => {
  vi.useFakeTimers({ now: NOW, toFake: ['Date'] });
  fetchAll.mockReset();
  vi.mocked(usePush).mockReturnValue({
    status: 'loading',
    busy: false,
    error: null,
    subscribe: vi.fn(),
    unsubscribe: vi.fn(),
    sendTest: vi.fn(),
  });
  mockDashboard();
});

describe('DashboardPage', () => {
  it('GitHub タブに Codespaces・Actions・Copilot を出す', () => {
    render(<DashboardPage />);
    expect(tab(/GitHub/)).toHaveAttribute('aria-selected', 'true');
    expect(headings()).toEqual(['⬡ Codespaces', 'ϟ Actions', '✦ Copilot']);
    expect(screen.getByRole('link', { name: 'meme' })).toBeInTheDocument();
    expect(screen.queryByText(/静的プレビューです/)).toBeNull();
  });

  it('Cloudflare タブに切り替えて、選んだタブを覚える', () => {
    render(<DashboardPage />);
    fireEvent.click(tab(/Cloudflare/));
    expect(headings()).toEqual([
      '☁︎ Workers Builds',
      '◷ 日次の無料枠',
      '▤ ストレージ・月次',
    ]);
    expect(
      JSON.parse(localStorage.getItem('codespacedash:settings') ?? '{}')
        .serviceTab,
    ).toBe('cloudflare');
  });

  it('Cloudflare の使用量が取れていれば各項目のバーを出す', () => {
    const ok = (data: number) => ({ status: 'ok' as const, data });
    mockDashboard({
      data: dashboard({
        cloudflare: {
          usage: ok({
            daily: { workersRequests: ok(50_000) },
            monthly: { r2StorageGb: ok(2) },
            dayStart: '',
            monthStart: '',
          } as never) as never,
        },
      }),
    });
    localStorage.setItem(
      'codespacedash:settings',
      JSON.stringify({ serviceTab: 'cloudflare' }),
    );
    const { container } = render(<DashboardPage />);
    expect(container).toHaveTextContent(
      'Workers リクエスト使用 50,000 / 100,000 回 ・ 50%',
    );
    expect(container).toHaveTextContent(
      'R2 ストレージ（現在）使用 2.0 / 10 GB',
    );
  });

  describe('タブの赤い点', () => {
    const dots = () => ({
      github: within(tab(/GitHub/)).queryByTitle('要確認') !== null,
      cloudflare: within(tab(/Cloudflare/)).queryByTitle('要確認') !== null,
    });
    const show = (d: DashboardResponse | null) => {
      mockDashboard({ data: d });
      render(<DashboardPage />);
      return dots();
    };

    it('Actions・Workers Builds に失敗があれば点を出す', () => {
      expect(
        show(
          dashboard({
            github: {
              runs: { status: 'ok', data: [run({ conclusion: 'failure' })] },
            },
            cloudflare: {
              builds: {
                status: 'ok',
                data: buildsSummary({ builds: [build({ outcome: 'fail' })] }),
              },
            },
          }),
        ),
      ).toEqual({ github: true, cloudflare: true });
    });

    it('失敗がなければ出さない（実行中の失敗はまだ数えない）', () => {
      expect(
        show(
          dashboard({
            github: {
              runs: {
                status: 'ok',
                data: [run({ status: 'in_progress', conclusion: 'failure' })],
              },
            },
          }),
        ),
      ).toEqual({ github: false, cloudflare: false });
    });

    it('取れていなければ出さない', () => {
      expect(
        show(
          dashboard({
            github: { runs: { status: 'error', message: 'x' } },
            cloudflare: { builds: { status: 'error', message: 'x' } },
          }),
        ),
      ).toEqual({ github: false, cloudflare: false });
    });

    it('データがまだなければ出さない', () => {
      mockDashboard({ data: null, loading: false });
      render(<DashboardPage />);
      expect(dots()).toEqual({ github: false, cloudflare: false });
    });
  });

  it('初回の取得中はスケルトンを出す', () => {
    mockDashboard({ data: null, loading: true });
    const { container } = render(<DashboardPage />);
    expect(screen.queryAllByRole('heading', { level: 2 })).toHaveLength(0);
    expect(
      container.querySelector('main > div:last-child')?.children,
    ).toHaveLength(3);
  });

  it('データがなく取得中でもなければ何も出さない', () => {
    mockDashboard({ data: null, loading: false });
    const { container } = render(<DashboardPage />);
    expect(container.querySelector('main')?.lastElementChild).toHaveAttribute(
      'role',
      'tablist',
    );
  });

  it('エラーを出す', () => {
    mockDashboard({ error: 'GitHub API 502' });
    render(<DashboardPage />);
    expect(screen.getByText(/⚠️ GitHub API 502/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '再読み込み' })).toBeNull();
  });

  it('セッション切れなら再読み込みのボタンを出す', () => {
    const reload = vi.fn();
    vi.stubGlobal('location', { reload });
    mockDashboard({ error: 'セッションが切れました', sessionExpired: true });
    render(<DashboardPage />);
    fireEvent.click(screen.getByRole('button', { name: '再読み込み' }));
    expect(reload).toHaveBeenCalled();
  });

  it('更新ボタンと停止ボタンをつなぐ', () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    render(<DashboardPage />);
    fireEvent.click(screen.getByRole('button', { name: '↻' }));
    expect(fetchAll).toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: '停止' }));
    expect(stopCodespace).toHaveBeenCalledWith('cs-1');
  });

  it('設定を変えるとプランに反映する', () => {
    render(<DashboardPage />);
    fireEvent.click(screen.getByRole('button', { name: '⚙' }));
    fireEvent.change(screen.getByLabelText(/^GitHub/), {
      target: { value: 'pro' },
    });
    expect(
      screen.getByText(/GitHub Pro の無料枠（2コア換算）/),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole('tab', { name: 'デバッグ' }));
    fireEvent.click(screen.getByRole('checkbox'));
    expect(screen.getByText('DEBUG')).toBeInTheDocument();
  });

  it('静的プレビューではその旨を出す', () => {
    setPreview(true);
    // 保存した設定を読むときに、静的プレビューならデバッグをオンにする
    localStorage.setItem('codespacedash:settings', '{}');
    mockDashboard({ data: null });
    render(<DashboardPage />);
    expect(screen.getByText(/静的プレビューです/)).toBeInTheDocument();
    // デバッグの設定から疑似データを作って出す
    expect(headings()).toEqual(['⬡ Codespaces', 'ϟ Actions', '✦ Copilot']);
  });
});
