import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { type PushStatus, usePush } from '@/hooks/usePush';
import { EMPTY_DEBUG, type Settings } from '@/hooks/useSettings';
import { NOW } from '@/testing/fixtures';
import { setPreview } from '@/testing/previewMock';
import { Header } from './Header';
import { btnRefreshSpinning } from './style.css';

vi.mock('@/lib/preview', () =>
  import('@/testing/previewMock').then((m) => m.previewModule),
);
vi.mock('@/hooks/usePush', () => ({ usePush: vi.fn() }));

const push = {
  subscribe: vi.fn(),
  unsubscribe: vi.fn(),
  sendTest: vi.fn(),
};
const mockPush = (
  status: PushStatus,
  p: { busy?: boolean; error?: string | null } = {},
) =>
  vi.mocked(usePush).mockReturnValue({
    status,
    busy: p.busy ?? false,
    error: p.error ?? null,
    ...push,
  });

const settings: Settings = {
  githubPlan: 'auto',
  copilotPlan: 'pro',
  workersPlan: 'auto',
  serviceTab: 'github',
  debug: EMPTY_DEBUG,
};

const header = (p: Partial<Parameters<typeof Header>[0]> = {}) => {
  const onRefresh = vi.fn();
  render(
    <Header
      user={{
        login: 'me',
        name: null,
        avatar_url: 'https://avatars.example.com/me',
        html_url: 'https://github.com/me',
        plan: null,
      }}
      onRefresh={onRefresh}
      loading={false}
      lastFetched={NOW}
      settings={settings}
      plans={{
        github: 'free',
        githubDetected: 'free',
        copilot: 'pro',
        workers: 'free',
        workersDetected: 'free',
      }}
      onChangeSettings={vi.fn()}
      onChangeDebug={vi.fn()}
      {...p}
    />,
  );
  return { onRefresh };
};

beforeEach(() => {
  for (const f of Object.values(push)) {
    f.mockReset();
  }
  mockPush('off');
});

describe('Header', () => {
  it('ロゴ・更新時刻・ユーザー・ログアウトを出す', () => {
    header();
    expect(screen.getByAltText('CodespaceDash')).toHaveAttribute(
      'src',
      '/base/logo.svg',
    );
    expect(
      screen.getByText(`${NOW.toLocaleTimeString('ja-JP')} 更新`),
    ).toBeInTheDocument();
    const user = screen.getByRole('link', { name: 'meme' });
    expect(user).toHaveAttribute('href', 'https://github.com/me');
    expect(user).toHaveAttribute('target', '_blank');
    expect(screen.getByAltText('me')).toHaveAttribute(
      'src',
      'https://avatars.example.com/me',
    );
    expect(screen.getByRole('link', { name: 'ログアウト' })).toHaveAttribute(
      'href',
      '/cdn-cgi/access/logout',
    );
    expect(screen.queryByText('DEBUG')).toBeNull();
  });

  it('まだ取得していなければ時刻とユーザーは出さない', () => {
    header({ user: null, lastFetched: null });
    expect(screen.queryByText(/更新$/)).toBeNull();
    expect(screen.queryByRole('link', { name: /me/ })).toBeNull();
  });

  it('更新ボタンで取り直し、取得中は押せずにアイコンを回す', () => {
    const { onRefresh } = header();
    const btn = screen.getByRole('button', { name: '↻' });
    expect(btn.firstElementChild).not.toHaveClass(btnRefreshSpinning);
    fireEvent.click(btn);
    expect(onRefresh).toHaveBeenCalled();
  });

  it('取得中は更新ボタンを押せない', () => {
    header({ loading: true });
    const btn = screen.getByRole('button', { name: '↻' });
    expect(btn).toBeDisabled();
    expect(btn.firstElementChild).toHaveClass(btnRefreshSpinning);
  });

  it('デバッグ中はバッジを出す', () => {
    header({
      settings: { ...settings, debug: { ...EMPTY_DEBUG, enabled: true } },
    });
    expect(
      screen.getByTitle('デバッグモード：疑似値を表示中'),
    ).toHaveTextContent('DEBUG');
  });

  it('静的プレビューでは通知とログアウトを出さない', () => {
    setPreview(true);
    header();
    expect(screen.queryByRole('link', { name: 'ログアウト' })).toBeNull();
    expect(screen.queryByRole('button', { name: /通知/ })).toBeNull();
    expect(usePush).not.toHaveBeenCalled();
  });

  describe('通知ボタン', () => {
    it('確認中は出さない', () => {
      mockPush('loading');
      header();
      expect(screen.queryByRole('button', { name: /通知/ })).toBeNull();
    });

    it('オフなら有効化ボタン', () => {
      header();
      const btn = screen.getByRole('button', { name: '🔕通知を有効化' });
      fireEvent.click(btn);
      expect(push.subscribe).toHaveBeenCalled();
    });

    it('オンならテスト通知とオフにするボタン', () => {
      mockPush('on');
      header();
      fireEvent.click(screen.getByRole('button', { name: 'テスト通知' }));
      expect(push.sendTest).toHaveBeenCalled();
      fireEvent.click(screen.getByRole('button', { name: '🔔通知オン' }));
      expect(push.unsubscribe).toHaveBeenCalled();
    });

    it.each(['on', 'off'] as const)(
      '%s で処理中は押せず、エラーを出す',
      (status) => {
        mockPush(status, { busy: true, error: '登録に失敗' });
        header();
        for (const b of screen.getAllByRole('button', { name: /通知/ })) {
          expect(b).toBeDisabled();
        }
        expect(screen.getByText('登録に失敗')).toBeInTheDocument();
      },
    );

    it.each([
      ['needs-install', '📲', 'ホーム画面に追加'],
      ['unsupported', '🔕', 'このブラウザはプッシュ通知に対応していません'],
      ['disabled', '🔕', 'サーバー側でプッシュ通知が設定されていません'],
      ['denied', '🔕', 'ブラウザの設定で通知がブロックされています'],
    ] as const)('%s なら理由を案内する', (status, icon, hint) => {
      mockPush(status);
      const alert = vi.spyOn(window, 'alert').mockImplementation(() => {});
      header();
      const btn = screen.getByRole('button', { name: `${icon}通知` });
      expect(btn.getAttribute('title')).toContain(hint);
      fireEvent.click(btn);
      expect(alert).toHaveBeenCalledWith(expect.stringContaining(hint));
    });
  });
});
