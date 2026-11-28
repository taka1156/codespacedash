import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { NOW } from '@/testing/fixtures';
import { setPreview } from '@/testing/previewMock';
import { Header } from './Header';
import { btnRefreshSpinning } from './style.css';

vi.mock('@/lib/preview', () =>
  import('@/testing/previewMock').then((m) => m.previewModule),
);

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
      debug={false}
      settingsAlert={false}
      {...p}
    />,
  );
  return { onRefresh };
};

describe('Header', () => {
  it('ロゴ・更新時刻・ユーザー・ログアウトを出す', () => {
    header();
    expect(screen.getByAltText('QuotaDash')).toHaveAttribute(
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
    const btn = screen.getByRole('button', { name: '更新' });
    expect(btn.firstElementChild).not.toHaveClass(btnRefreshSpinning);
    fireEvent.click(btn);
    expect(onRefresh).toHaveBeenCalled();
  });

  it('取得中は更新ボタンを押せない', () => {
    header({ loading: true });
    const btn = screen.getByRole('button', { name: '更新' });
    expect(btn).toBeDisabled();
    expect(btn.firstElementChild).toHaveClass(btnRefreshSpinning);
  });

  it('デバッグ中はバッジを出す', () => {
    header({ debug: true });
    expect(
      screen.getByTitle('デバッグモード：疑似値を表示中'),
    ).toHaveTextContent('DEBUG');
  });

  it('静的プレビューではログアウトを出さない', () => {
    setPreview(true);
    header();
    expect(screen.queryByRole('link', { name: 'ログアウト' })).toBeNull();
  });

  it('歯車は設定ページへのリンク', () => {
    header();
    const link = screen.getByRole('link', { name: '設定' });
    expect(link).toHaveAttribute('href', '#/settings/plans');
    expect(link.querySelector('svg[data-icon="settings"]')).not.toBeNull();
    expect(link.querySelectorAll('span')).toHaveLength(0);
  });

  it('確認してほしいことがあれば点を付け、トークンの項目を開く', () => {
    header({ settingsAlert: true });
    const link = screen.getByRole('link', { name: '設定（要確認）' });
    expect(link).toHaveAttribute('href', '#/settings/tokens');
    expect(link.querySelectorAll('span')).toHaveLength(1);
  });

  it('通知のボタンはヘッダーに出さない（設定ページに移した）', () => {
    header();
    expect(screen.queryByRole('button', { name: /通知/ })).toBeNull();
  });
});
