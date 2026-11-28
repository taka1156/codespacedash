import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { WorkflowRun } from '@/lib/types';
import { ago, NOW, run } from '@/testing/fixtures';
import { RunHistory } from './RunHistory';

const ok = (data: WorkflowRun[]) => ({ status: 'ok' as const, data });
const items = () => screen.getAllByRole('link');

beforeEach(() => {
  vi.useFakeTimers({ now: NOW, toFake: ['Date'] });
});

describe('RunHistory', () => {
  it('取れなければ理由を出す', () => {
    const { container } = render(
      <RunHistory
        runs={{
          status: 'forbidden',
          permission: 'Actions: Read',
          message: 'm',
        }}
      />,
    );
    expect(container).toHaveTextContent('実行履歴を見る権限が足りません');
    expect(container).toHaveTextContent('実行履歴最近pushした15リポジトリ');
  });

  it('実行がなければその旨を出す', () => {
    render(<RunHistory runs={ok([])} />);
    expect(screen.getByText('最近の実行はありません')).toBeInTheDocument();
  });

  it.each([
    [{ status: 'in_progress', conclusion: null }, '実行中', ''],
    [{ status: 'queued', conclusion: null }, '待機中', '•'],
    [{ status: 'waiting', conclusion: null }, '待機中', '•'],
    [{ conclusion: 'success' }, '成功', '✓'],
    [{ conclusion: 'failure' }, '失敗', '✕'],
    [{ conclusion: 'timed_out' }, '失敗', '✕'],
    [{ conclusion: 'startup_failure' }, '失敗', '✕'],
    [{ conclusion: 'cancelled' }, 'キャンセル/スキップ', '–'],
    [{ conclusion: null }, 'キャンセル/スキップ', '–'],
  ] as const)('%o は「%s」', (p, label, char) => {
    render(<RunHistory runs={ok([run(p)])} />);
    expect(screen.getByTitle(label)).toHaveTextContent(char);
  });

  it('実行中・失敗の件数を見出しに出す', () => {
    const { container } = render(
      <RunHistory
        runs={ok([
          run({ id: 1, status: 'in_progress', conclusion: null }),
          run({ id: 2, status: 'queued', conclusion: null }),
          run({ id: 3, conclusion: 'failure' }),
          run({ id: 4 }),
        ])}
      />,
    );
    expect(container).toHaveTextContent('実行履歴 · 2 実行中 / 1 失敗');
  });

  it.each([
    [[run({ conclusion: 'failure' })], '実行履歴 · 1 失敗'],
    [[run({ status: 'in_progress' })], '実行履歴 · 1 実行中'],
    [[run()], '実行履歴最近'],
  ])('件数は あるものだけ出す %#', (runs, text) => {
    const { container } = render(<RunHistory runs={ok(runs)} />);
    expect(container).toHaveTextContent(text);
  });

  it('タイトル・ワークフロー・リポジトリ・ブランチ・イベント・番号を出す', () => {
    render(<RunHistory runs={ok([run()])} />);
    const a = items()[0];
    expect(a).toHaveAttribute(
      'href',
      'https://github.com/me/app/actions/runs/1',
    );
    expect(a).toHaveAttribute('target', '_blank');
    expect(a).toHaveTextContent('feat: x · CI');
    expect(a).toHaveTextContent('me/appmainpush#7');
  });

  it.each([
    ['pull_request', 'PR'],
    ['workflow_dispatch', '手動'],
    ['schedule', '定期'],
    ['release', 'release'],
    ['repository_dispatch', 'dispatch'],
    ['merge_group', 'merge_group'],
  ])('イベント %s は「%s」', (event, label) => {
    render(<RunHistory runs={ok([run({ event })])} />);
    expect(items()[0]).toHaveTextContent(`me/appmain${label}#7`);
  });

  it('ブランチがなければ出さない', () => {
    render(<RunHistory runs={ok([run({ branch: null })])} />);
    expect(items()[0]).toHaveTextContent('me/apppush#7');
  });

  it.each([
    [ago(0.5), 'たった今'],
    [ago(59), '59分前'],
    [ago(60 * 23), '23時間前'],
    [ago(60 * 24 * 2), '2日前'],
  ])('作成 %s は「%s」', (createdAt, text) => {
    render(<RunHistory runs={ok([run({ createdAt })])} />);
    expect(items()[0]).toHaveTextContent(text);
  });

  describe('所要時間', () => {
    const at = (sec: number) =>
      new Date(NOW.getTime() - sec * 1000).toISOString();

    it.each([
      [{ startedAt: at(45), updatedAt: at(0) }, '45秒'],
      // 単位が変わる境目
      [{ startedAt: at(59), updatedAt: at(0) }, '59秒'],
      [{ startedAt: at(60), updatedAt: at(0) }, '1分0秒'],
      [{ startedAt: at(3599), updatedAt: at(0) }, '59分59秒'],
      [{ startedAt: at(3600), updatedAt: at(0) }, '1時間0分'],
      [{ startedAt: at(125), updatedAt: at(0) }, '2分5秒'],
      [{ startedAt: at(3 * 3600 + 7 * 60), updatedAt: at(0) }, '3時間7分'],
      // 開始時刻がなければ作成時刻から
      [{ startedAt: null, createdAt: at(30), updatedAt: at(0) }, '30秒'],
      // 時刻が逆転していても 0秒
      [{ startedAt: at(0), updatedAt: at(10) }, '0秒'],
      // 実行中は今まで
      [
        { status: 'in_progress', startedAt: at(90), updatedAt: at(80) },
        '1分30秒',
      ],
      // 時刻が読めなければ NaN と出さない
      [{ startedAt: 'x', updatedAt: at(0) }, '—'],
    ] as const)('%o は %s', (p, text) => {
      render(<RunHistory runs={ok([run(p)])} />);
      expect(items()[0]).toHaveTextContent(`#7${text}`);
    });

    it('待機中は出さない', () => {
      render(<RunHistory runs={ok([run({ status: 'queued' })])} />);
      expect(items()[0].textContent?.endsWith('#7')).toBe(true);
    });
  });

  describe('private / public の切り替え', () => {
    const tab = (name: RegExp) => screen.getByRole('tab', { name });
    const mixed = () =>
      ok([
        run({ id: 1, repo: 'me/pub', title: 'pub ok' }),
        run({
          id: 2,
          repo: 'me/priv',
          private: true,
          title: 'priv ng',
          conclusion: 'failure',
        }),
        run({ id: 3, repo: 'me/priv', private: true, title: 'priv ok' }),
      ]);

    it('件数付きのタブを出し、最新の実行がある側を開く', () => {
      render(<RunHistory runs={mixed()} />);
      expect(tab(/private \(2\)/)).toHaveAttribute('aria-selected', 'false');
      expect(tab(/public \(1\)/)).toHaveAttribute('aria-selected', 'true');
      expect(items()).toHaveLength(1);
      expect(items()[0]).toHaveTextContent('pub ok');
    });

    it('最新が private なら private を開く', () => {
      render(
        <RunHistory
          runs={ok([run({ id: 2, private: true }), run({ id: 1 })])}
        />,
      );
      expect(tab(/private/)).toHaveAttribute('aria-selected', 'true');
    });

    it('実行がなければ private を開く', () => {
      render(<RunHistory runs={ok([])} />);
      expect(tab(/private \(0\)/)).toHaveAttribute('aria-selected', 'true');
    });

    it('切り替えると、その側の実行と件数を出す', () => {
      const { container } = render(<RunHistory runs={mixed()} />);
      expect(container).not.toHaveTextContent('1 失敗');
      fireEvent.click(tab(/private/));
      expect(items().map((a) => a.textContent)).toEqual([
        expect.stringContaining('priv ng'),
        expect.stringContaining('priv ok'),
      ]);
      expect(container).toHaveTextContent('実行履歴 · 1 失敗');
    });

    it('見ていない側で失敗していれば、そのタブに点を出す', () => {
      render(<RunHistory runs={mixed()} />);
      expect(tab(/private/)).toContainElement(screen.getByTitle('要確認'));
      fireEvent.click(tab(/private/));
      expect(screen.queryByTitle('要確認')).toBeNull();
    });

    it('取れなかったときはタブを出さない', () => {
      render(<RunHistory runs={{ status: 'error', message: 'x' }} />);
      expect(screen.queryByRole('tablist')).toBeNull();
    });
  });
});
