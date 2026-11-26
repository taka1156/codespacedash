import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { WorkersPlan } from '@/lib/plans';
import type { SectionState, WorkersBuildsSummary } from '@/lib/types';
import { ago, build, buildsSummary, NOW } from '@/testing/fixtures';
import { WorkersPanel } from './WorkersPanel';

const ok = (p: Partial<WorkersBuildsSummary> = {}) => ({
  status: 'ok' as const,
  data: buildsSummary(p),
});

const panel = (
  s: SectionState<WorkersBuildsSummary>,
  plan: WorkersPlan = 'free',
) => render(<WorkersPanel builds={s} plan={plan} />);

const items = () => screen.getAllByRole('link');
/** メタ情報の行の最後の項目（所要時間） */
const lastMeta = (a: HTMLElement) =>
  a.lastElementChild?.lastElementChild?.textContent;

beforeEach(() => {
  vi.useFakeTimers({ now: NOW, toFake: ['Date'] });
  // 期間の日付表示を日本時間でそろえる
  vi.stubEnv('TZ', 'Asia/Tokyo');
});

describe('WorkersPanel', () => {
  it('期間・Worker 数・ビルド時間を出す（期間の終わりは前日）', () => {
    const { container } = panel(ok());
    expect(container).toHaveTextContent('11/1〜11/30 のビルド時間 · 1 Worker');
    expect(container).toHaveTextContent('120 分');
    expect(container).toHaveTextContent(
      'Workers Free のビルド時間使用 120 / 3,000 分 ・ 4%',
    );
    expect(container).toHaveTextContent('各ビルドの所要時間');
    expect(container).not.toHaveTextContent('上限に達しています');
  });

  it('Paid は 6000 分の枠', () => {
    const { container } = panel(ok(), 'paid');
    expect(container).toHaveTextContent('使用 120 / 6,000 分');
  });

  it.each([
    ['API が上限到達を返した', { limitReached: true }, 'free'],
    ['Free で使い切った', { usedMinutes: 3000 }, 'free'],
    ['Paid でも API が上限到達を返した', { limitReached: true }, 'paid'],
  ] as const)('%s ときは上限の警告を出す', (_label, p, plan) => {
    const { container } = panel(ok(p), plan);
    expect(container).toHaveTextContent(
      '⚠ ビルド時間の上限に達しています。12/1にリセットされるまでビルドできません',
    );
  });

  it('Paid は 3000 分を超えても警告しない', () => {
    const { container } = panel(ok({ usedMinutes: 3000 }), 'paid');
    expect(container).not.toHaveTextContent('上限に達しています');
  });

  it('取れなければ理由を出す', () => {
    const { container } = panel({
      status: 'unconfigured',
      setting: 'CLOUDFLARE_API_TOKEN',
    });
    expect(container).toHaveTextContent('未設定 ・ 枠 3,000 分');
    expect(container).toHaveTextContent('Workers Buildsは未設定です');
    expect(container).not.toHaveTextContent('のビルド時間 ·');
  });

  it('ビルドがなければその旨を出す', () => {
    panel(ok({ builds: [] }));
    expect(screen.getByText('最近のビルドはありません')).toBeInTheDocument();
  });

  it('ビルドの内容を出す', () => {
    panel(ok());
    const a = items()[0];
    expect(a).toHaveAttribute('href', 'https://dash.cloudflare.com/b1');
    expect(a).toHaveAttribute('target', '_blank');
    expect(a).toHaveTextContent('feat: y · site');
    expect(a).toHaveTextContent('30分前');
    // コミットは7文字に縮める
    expect(a).toHaveTextContent('me/sitemainpushabcdef12分0秒');
    expect(screen.getByTitle('成功')).toHaveTextContent('✓');
  });

  it('コミットメッセージは1行目だけ。なければ代わりの文言', () => {
    panel(
      ok({
        builds: [
          build({ id: '1', commitMessage: 'title\n\nbody' }),
          build({ id: '2', commitMessage: null }),
          build({ id: '3', commitMessage: '' }),
        ],
      }),
    );
    const [a, b, c] = items();
    expect(a).toHaveTextContent('title · site');
    expect(a).not.toHaveTextContent('body');
    expect(b).toHaveTextContent('(メッセージなし) · site');
    expect(c).toHaveTextContent('(メッセージなし) · site');
  });

  it('情報のない項目は出さない', () => {
    panel(
      ok({
        builds: [
          build({ repo: null, branch: null, source: null, commitHash: null }),
        ],
      }),
    );
    expect(items()[0].lastElementChild?.textContent).toBe('2分0秒');
  });

  it.each([
    ['pull_request', 'PR'],
    ['manual', '手動'],
    ['api', 'API'],
    ['cron', 'cron'],
  ])('トリガー %s は「%s」', (source, label) => {
    panel(ok({ builds: [build({ source })] }));
    expect(items()[0]).toHaveTextContent(`main${label}abcdef1`);
  });

  it('状態ごとのアイコンと、ビルド中・失敗の件数', () => {
    const { container } = panel(
      ok({
        builds: [
          build({ id: '1', status: 'running', outcome: null, stoppedAt: null }),
          build({ id: '2', status: 'queued', outcome: null, stoppedAt: null }),
          build({ id: '3', outcome: 'fail' }),
          build({ id: '4', outcome: 'cancelled' }),
        ],
      }),
    );
    expect(container).toHaveTextContent('ビルド履歴 · 2 ビルド中 / 1 失敗');
    expect(screen.getByTitle('ビルド中')).toHaveTextContent('');
    expect(screen.getByTitle('待機中')).toHaveTextContent('•');
    expect(screen.getByTitle('失敗')).toHaveTextContent('✕');
    expect(screen.getByTitle('キャンセル/スキップ')).toHaveTextContent('–');
    // 待機中は所要時間を出さない
    expect(lastMeta(items()[1])).toBe('abcdef1');
  });

  it.each([
    [[build({ outcome: 'fail' })], 'ビルド履歴 · 1 失敗'],
    [
      [build({ status: 'running', stoppedAt: null })],
      'ビルド履歴 · 1 ビルド中',
    ],
    [[build()], 'ビルド履歴Git'],
  ])('件数は あるものだけ出す %#', (builds, text) => {
    const { container } = panel(ok({ builds }));
    expect(container).toHaveTextContent(text);
  });

  it.each([
    [{ createdAt: ago(0.5) }, 'たった今'],
    [{ createdAt: ago(59) }, '59分前'],
    [{ createdAt: ago(60 * 5) }, '5時間前'],
    [{ createdAt: ago(60 * 24 * 3) }, '3日前'],
  ])('作成 %o は「%s」', (p, text) => {
    panel(ok({ builds: [build(p)] }));
    expect(items()[0]).toHaveTextContent(text);
  });

  it.each([
    [{ startedAt: ago(0.75), stoppedAt: ago(0) }, '45秒'],
    // 開始時刻がなければ作成時刻から
    [{ startedAt: null, createdAt: ago(3), stoppedAt: ago(0) }, '3分0秒'],
    // ビルド中は今まで
    [{ status: 'running', startedAt: ago(1.5), stoppedAt: null }, '1分30秒'],
    // 時刻が逆転していても 0秒
    [{ startedAt: ago(0), stoppedAt: ago(1) }, '0秒'],
  ] as const)('所要時間 %o は %s', (p, text) => {
    panel(ok({ builds: [build(p)] }));
    expect(lastMeta(items()[0])).toBe(text);
  });
});
