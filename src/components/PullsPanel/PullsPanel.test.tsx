import { fireEvent, render, screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { RepoPulls, SectionState } from '@/lib/types';
import { ago, NOW, pull, repoPulls } from '@/testing/fixtures';
import { PullsPanel } from './PullsPanel';
import { countActive, iconDraft, iconOpen } from './style.css';

const ok = (data: RepoPulls[]): SectionState<RepoPulls[]> => ({
  status: 'ok',
  data,
});

const panel = (
  favorites: string[],
  pulls: SectionState<RepoPulls[]> | null,
  error: string | null = null,
) => render(<PullsPanel favorites={favorites} pulls={pulls} error={error} />);

const toggleOf = (name: RegExp) => screen.getByRole('button', { name });

beforeEach(() => {
  vi.useFakeTimers({ now: NOW, toFake: ['Date'] });
});

describe('PullsPanel', () => {
  it('お気に入りがなければ登録のしかたを出す', () => {
    panel([], null);
    expect(
      screen.getByText(/お気に入りのリポジトリがありません/),
    ).toBeInTheDocument();
    expect(screen.getByText('お気に入り 0 リポジトリ')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'すべて開く' })).toBeNull();
  });

  it('取得中は枠だけ出す', () => {
    const { container } = panel(['me/app', 'org/lib'], null);
    const busy = container.querySelector('[aria-busy="true"]');
    expect(busy?.children).toHaveLength(2);
  });

  it('通信に失敗して結果がなければエラーを出す', () => {
    panel(['me/app'], null, 'GitHub API 502');
    expect(screen.getByText('⚠ PRを取得できませんでした')).toBeInTheDocument();
    expect(screen.getByText('GitHub API 502')).toBeInTheDocument();
  });

  it('前の結果があれば、更新の失敗は一言だけ添える', () => {
    panel(['me/app'], ok([repoPulls()]), 'offline');
    expect(screen.getByRole('status')).toHaveTextContent(
      '更新できませんでした（前回の結果を表示しています）: offline',
    );
    expect(toggleOf(/me\/app/)).toBeInTheDocument();
  });

  it('権限不足などは足りない権限名を出す', () => {
    panel(['me/app'], {
      status: 'forbidden',
      permission: 'Pull requests: Read',
      message: 'no',
    });
    expect(screen.getByText('Pull requests: Read')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'すべて開く' })).toBeNull();
  });

  it('登録した順にリポジトリを並べ、件数と合計を出す', () => {
    panel(
      ['org/lib', 'me/app'],
      ok([
        repoPulls({ repo: 'me/app', totalCount: 3 }),
        repoPulls({
          repo: 'org/lib',
          url: 'https://github.com/org/lib',
          pulls: [],
        }),
      ]),
    );
    const heads = screen.getAllByRole('heading', { level: 3 });
    expect(heads.map((h) => h.textContent)).toEqual([
      '▸org/lib0↗',
      '▸me/app3↗',
    ]);
    expect(
      screen.getByText('お気に入り 2 リポジトリ · 合計 3 件'),
    ).toBeInTheDocument();
    expect(within(heads[1]).getByTitle('オープンな PR')).toHaveClass(
      countActive,
    );
    expect(within(heads[0]).getByTitle('オープンな PR')).not.toHaveClass(
      countActive,
    );
    expect(
      screen.getByRole('link', { name: 'org/lib の PR 一覧を GitHub で開く' }),
    ).toHaveAttribute('href', 'https://github.com/org/lib/pulls');
  });

  it('最初は PR があるリポジトリだけ開き、クリックで開閉する', () => {
    panel(
      ['me/app', 'org/lib'],
      ok([repoPulls(), repoPulls({ repo: 'org/lib', pulls: [] })]),
    );
    const app = toggleOf(/me\/app/);
    const lib = toggleOf(/org\/lib/);
    expect(app).toHaveAttribute('aria-expanded', 'true');
    expect(lib).toHaveAttribute('aria-expanded', 'false');
    const region = document.getElementById(
      app.getAttribute('aria-controls') ?? '',
    );
    expect(region).toHaveAttribute('aria-labelledby', app.id);

    fireEvent.click(lib);
    expect(lib).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByText('オープンな PR はありません')).toBeInTheDocument();

    fireEvent.click(app);
    expect(app).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByText('feat: PR タブ')).toBeNull();
  });

  it('すべて開く・すべて閉じる', () => {
    panel(
      ['me/app', 'org/lib'],
      ok([repoPulls(), repoPulls({ repo: 'org/lib', pulls: [] })]),
    );
    fireEvent.click(screen.getByRole('button', { name: 'すべて開く' }));
    expect(toggleOf(/me\/app/)).toHaveAttribute('aria-expanded', 'true');
    expect(toggleOf(/org\/lib/)).toHaveAttribute('aria-expanded', 'true');
    fireEvent.click(screen.getByRole('button', { name: 'すべて閉じる' }));
    expect(toggleOf(/me\/app/)).toHaveAttribute('aria-expanded', 'false');
    expect(toggleOf(/org\/lib/)).toHaveAttribute('aria-expanded', 'false');
  });

  it('大文字小文字が違っても同じリポジトリとして結果を対応させる', () => {
    panel(['Me/App'], ok([repoPulls({ repo: 'me/app' })]));
    expect(toggleOf(/Me\/App/)).toHaveAttribute('aria-expanded', 'true');
  });

  it('PR の中身（番号・作成者・ブランチ・レビュー・コメント）を出す', () => {
    panel(
      ['me/app'],
      ok([
        repoPulls({
          pulls: [
            pull({ review: 'approved', comments: 4 }),
            pull({
              number: 11,
              title: 'wip',
              draft: true,
              author: null,
              review: 'changes_requested',
              updatedAt: ago(60 * 5),
            }),
            pull({ number: 10, title: 'req', review: 'review_required' }),
          ],
        }),
      ]),
    );
    const links = screen
      .getAllByRole('link')
      .filter((a) => a.getAttribute('href')?.includes('/pull/'));
    expect(links).toHaveLength(3);
    const [first, second, third] = links;
    expect(first).toHaveAttribute('href', 'https://github.com/me/app/pull/12');
    expect(first).toHaveAttribute('target', '_blank');
    expect(first).toHaveTextContent('feat: PR タブ');
    expect(first).toHaveTextContent('30分前');
    expect(first).toHaveTextContent('#12');
    expect(first).toHaveTextContent('me');
    expect(first).toHaveTextContent('feat/pulls');
    expect(first).toHaveTextContent('承認済み');
    expect(first).toHaveTextContent('💬 4');
    expect(within(first).getByTitle('Open')).toHaveClass(iconOpen);

    expect(second).toHaveTextContent('Draft');
    expect(second).toHaveTextContent('変更依頼');
    expect(second).toHaveTextContent('5時間前');
    expect(second).not.toHaveTextContent('💬');
    expect(within(second).getByTitle('Draft')).toHaveClass(iconDraft);
    expect(within(second).queryByText('me')).toBeNull();

    expect(third).toHaveTextContent('レビュー待ち');
    expect(third).not.toHaveTextContent('Draft');
  });

  it('表示しきれない分は GitHub へのリンクを出す', () => {
    panel(['me/app'], ok([repoPulls({ totalCount: 15 })]));
    expect(
      screen.getByRole('link', { name: /ほか 14 件を GitHub で見る/ }),
    ).toHaveAttribute('href', 'https://github.com/me/app/pulls');
  });

  it('全部表示できていればリンクは出さない', () => {
    panel(['me/app'], ok([repoPulls()]));
    expect(screen.queryByRole('link', { name: /ほか/ })).toBeNull();
  });

  it('private には鍵を付ける', () => {
    panel(['me/secret'], ok([repoPulls({ repo: 'me/secret', private: true })]));
    expect(
      within(toggleOf(/me\/secret/)).getByTitle('private'),
    ).toBeInTheDocument();
  });

  it('見つからないリポジトリはその旨を出す', () => {
    panel(
      ['me/gone'],
      ok([
        repoPulls({
          repo: 'me/gone',
          found: false,
          url: 'https://github.com/me/gone',
          pulls: [],
          totalCount: 0,
        }),
      ]),
    );
    const t = toggleOf(/me\/gone/);
    expect(t).toHaveTextContent('見つかりません');
    fireEvent.click(t);
    expect(screen.getByText(/リポジトリが見つかりません/)).toBeInTheDocument();
  });

  it('登録した直後でまだ結果にないリポジトリは読み込み中にする', () => {
    panel(['me/app', 'me/new'], ok([repoPulls()]));
    const t = toggleOf(/me\/new/);
    expect(t).toHaveTextContent('…');
    expect(t).toHaveAttribute('aria-expanded', 'false');
    expect(
      screen.getByRole('link', { name: 'me/new の PR 一覧を GitHub で開く' }),
    ).toHaveAttribute('href', 'https://github.com/me/new/pulls');
    fireEvent.click(t);
    expect(screen.getByText('読み込み中…')).toBeInTheDocument();
  });
});
