import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { BillingUsageSummary, Codespace, SectionState } from '@/lib/types';
import { ago, codespace, NOW, usageItem } from '@/testing/fixtures';
import { CodespacesPanel } from './CodespacesPanel';

const billing: SectionState<BillingUsageSummary> = {
  status: 'ok',
  data: {
    timePeriod: { year: 2026, month: 11 },
    usageItems: [
      usageItem({
        sku: 'codespaces_compute_d2',
        unitType: 'hours',
        grossQuantity: 30,
      }),
    ],
  },
};

const panel = (
  codespaces: SectionState<Codespace[]>,
  p: Partial<Parameters<typeof CodespacesPanel>[0]> = {},
) =>
  render(
    <CodespacesPanel
      codespaces={codespaces}
      notifyAfterMin={60}
      onStop={vi.fn(async () => {})}
      billing={billing}
      plan="free"
      {...p}
    />,
  );

const ok = (data: Codespace[]) => ({ status: 'ok' as const, data });
const items = () =>
  screen
    .getAllByRole('link', { name: '開く' })
    .map((a) => a.parentElement?.parentElement as HTMLElement);

beforeEach(() => {
  vi.useFakeTimers({ now: NOW, toFake: ['Date'] });
});

describe('CodespacesPanel', () => {
  describe('無料枠', () => {
    it('コア時間とストレージの使用量を出す', () => {
      const { container } = panel(ok([]));
      expect(container).toHaveTextContent(
        'GitHub Free の無料枠（2コア換算）使用 30 / 60 時間 ・ 50%',
      );
      expect(container).toHaveTextContent(
        'GitHub Free のストレージ枠（停止中も加算）使用 0 / 15 GB-月',
      );
    });

    it('Pro は枠が大きい', () => {
      const { container } = panel(ok([]), { plan: 'pro' });
      expect(container).toHaveTextContent('使用 30 / 90 時間');
    });

    it('使用量が取れなければ理由と、2コア換算の枠を出す', () => {
      const { container } = panel(ok([]), {
        billing: {
          status: 'forbidden',
          permission: 'Plan: Read',
          message: 'x',
        },
      });
      expect(container).toHaveTextContent(
        '権限不足（Plan: Read） ・ 枠 60 時間',
      );
      expect(container).toHaveTextContent(
        '権限不足（Plan: Read） ・ 枠 15 GB-月',
      );
    });

    it('使用量が取れなくても Pro は 2コア換算で 90 時間', () => {
      const { container } = panel(ok([]), {
        plan: 'pro',
        billing: { status: 'error', message: 'x' },
      });
      expect(container).toHaveTextContent('取得失敗 ・ 枠 90 時間');
    });
  });

  it('一覧が取れなければ理由を出す（無料枠は出す）', () => {
    const { container } = panel({ status: 'error', message: 'boom' });
    expect(container).toHaveTextContent(
      'Codespaces の一覧を取得できませんでした',
    );
    expect(container).toHaveTextContent('使用 30 / 60 時間');
    expect(container).toHaveTextContent('—');
  });

  it('1台もなければその旨を出す', () => {
    const { container } = panel(ok([]));
    expect(container).toHaveTextContent('コードスペースはありません 🎉');
    expect(container).toHaveTextContent('0 稼働中 / 0 合計');
  });

  it('稼働中 → 起動・停止中 → エラー → 停止の順、同じなら最近使った順に並べる', () => {
    panel(
      ok([
        codespace({ id: 1, display_name: 'idle', state: 'Shutdown' }),
        codespace({ id: 2, display_name: 'old', last_used_at: ago(50) }),
        codespace({ id: 3, display_name: 'failed', state: 'Failed' }),
        codespace({ id: 4, display_name: 'starting', state: 'Starting' }),
        codespace({ id: 5, display_name: 'new', last_used_at: ago(5) }),
        codespace({ id: 6, display_name: 'never', last_used_at: null }),
        codespace({ id: 7, display_name: 'stopping', state: 'Stopping' }),
      ]),
    );
    expect(
      items().map((i) => i.querySelector('span + span')?.textContent),
    ).toEqual([
      'new',
      'old',
      'never',
      'starting',
      'stopping',
      'failed',
      'idle',
    ]);
    expect(screen.getByText('3 稼働中 / 7 合計')).toBeInTheDocument();
    expect(screen.getByText('7')).toBeInTheDocument();
  });

  it.each([
    [null, ago(5)],
    [ago(5), null],
  ])('最終使用がないものは古い扱い（%s, %s）', (a, b) => {
    panel(
      ok([
        codespace({ id: 1, display_name: 'a', last_used_at: a }),
        codespace({ id: 2, display_name: 'b', last_used_at: b }),
      ]),
    );
    const names = items().map(
      (i) => i.querySelector('span + span')?.textContent,
    );
    expect(names).toEqual(a === null ? ['b', 'a'] : ['a', 'b']);
  });

  it.each([
    ['Available', '稼働中'],
    ['Starting', '起動中'],
    ['Rebuilding', '再構築中'],
    ['Stopping', '停止中'],
    ['ShuttingDown', 'シャットダウン中'],
    ['Shutdown', '停止'],
    ['Failed', 'エラー'],
    ['Deleted', '削除済み'],
    ['Unavailable', '利用不可'],
    // 知らない状態はそのまま出す
    ['Exporting', 'Exporting'],
  ])('状態 %s は「%s」', (state, label) => {
    panel(ok([codespace({ state })]));
    expect(within(items()[0]).getByText(label)).toBeInTheDocument();
  });

  it('マシンの情報と場所、最終使用、自動停止を出す', () => {
    panel(
      ok([
        codespace({
          machine: {
            name: 'm',
            display_name: 'm',
            cpus: 4,
            memory_in_bytes: 16 * 1024 ** 3,
            storage_in_bytes: 512 * 1024 ** 2,
          },
          last_used_at: ago(5),
        }),
      ]),
    );
    const item = items()[0];
    expect(item).toHaveTextContent('4コア');
    expect(item).toHaveTextContent('16GB RAM');
    // 1GB 未満は MB で出す
    expect(item).toHaveTextContent('512MB ストレージ');
    expect(item).toHaveTextContent('EastUs');
    expect(item).toHaveTextContent('最終使用: 5分前 ・ 自動停止 30分');
  });

  it('マシンの情報がなければその旨を出す', () => {
    panel(ok([codespace({ machine: null, idle_timeout_minutes: null })]));
    expect(items()[0]).toHaveTextContent('マシン情報なし');
    expect(items()[0]).not.toHaveTextContent('自動停止');
  });

  it.each([
    [null, '最終使用: —'],
    [ago(59), '最終使用: 59分前'],
    [ago(60 * 5), '最終使用: 5時間前'],
    [ago(60 * 24 * 3), '最終使用: 3日前'],
  ])('最終使用 %s は「%s」', (last, text) => {
    panel(ok([codespace({ state: 'Shutdown', last_used_at: last })]));
    expect(items()[0]).toHaveTextContent(text);
  });

  it('表示名がなければ名前を出す', () => {
    panel(ok([codespace({ display_name: null, name: 'raw-name' })]));
    expect(screen.getByText('raw-name')).toBeInTheDocument();
  });

  describe('自動削除', () => {
    const until = (days: number) =>
      new Date(NOW.getTime() + days * 86_400_000).toISOString();

    it('停止中なら残り日数を出す', () => {
      panel(
        ok([
          codespace({
            id: 1,
            state: 'Shutdown',
            retention_expires_at: until(12.5),
          }),
          codespace({
            id: 2,
            state: 'Shutdown',
            retention_expires_at: until(0.5),
          }),
          codespace({ id: 3, state: 'Shutdown', retention_expires_at: null }),
        ]),
      );
      const [a, b, c] = items();
      expect(a).toHaveTextContent('自動削除 12日後');
      expect(b).toHaveTextContent('自動削除 1日以内');
      expect(c).not.toHaveTextContent('自動削除');
    });

    it('日時が読めなければ NaN と出さない（最終使用は —、自動削除は出さない）', () => {
      panel(
        ok([
          codespace({
            state: 'Shutdown',
            last_used_at: 'x',
            retention_expires_at: 'x',
          }),
        ]),
      );
      const [a] = items();
      expect(a).toHaveTextContent('最終使用: —');
      expect(a).not.toHaveTextContent('自動削除');
      expect(a).not.toHaveTextContent('NaN');
    });

    it('稼働中は出さない', () => {
      panel(ok([codespace({ retention_expires_at: until(3) })]));
      expect(items()[0]).not.toHaveTextContent('自動削除');
    });
  });

  describe('警告', () => {
    it('通知の分数以上使われていない稼働中のものは つけっぱなし', () => {
      panel(ok([codespace({ last_used_at: ago(60) })]), { notifyAfterMin: 60 });
      expect(items()[0]).toHaveTextContent(
        '⏰ 60分以上使われていません。つけっぱなしかもしれません',
      );
    });

    it('通知の分数未満・停止中は警告しない', () => {
      panel(
        ok([
          codespace({ id: 1, last_used_at: ago(59) }),
          codespace({ id: 2, state: 'Shutdown', last_used_at: ago(999) }),
        ]),
      );
      expect(screen.queryByText(/つけっぱなし/)).toBeNull();
    });

    it('未 push の変更があれば警告する', () => {
      panel(ok([codespace({ has_unpushed_changes: true })]));
      expect(items()[0]).toHaveTextContent('⚠ 未コミット/未プッシュの変更あり');
    });
  });

  describe('停止', () => {
    it('稼働中のものだけ停止ボタンを出し、開くリンクは新しいタブ', () => {
      panel(
        ok([codespace({ id: 1 }), codespace({ id: 2, state: 'Shutdown' })]),
      );
      expect(screen.getAllByRole('button', { name: '停止' })).toHaveLength(1);
      const link = screen.getAllByRole('link', { name: '開く' })[0];
      expect(link).toHaveAttribute(
        'href',
        'https://github.com/codespaces/cs-1',
      );
      expect(link).toHaveAttribute('target', '_blank');
      expect(link).toHaveAttribute('rel', 'noopener noreferrer');
    });

    it('確認してから停止し、終わるまでボタンを押せなくする', async () => {
      vi.spyOn(window, 'confirm').mockReturnValue(true);
      let done = () => {};
      const onStop = vi.fn(
        () =>
          new Promise<void>((r) => {
            done = r;
          }),
      );
      panel(ok([codespace({ name: 'cs-x', display_name: 'X' })]), { onStop });

      fireEvent.click(screen.getByRole('button', { name: '停止' }));
      expect(window.confirm).toHaveBeenCalledWith('X を停止しますか？');
      expect(onStop).toHaveBeenCalledWith('cs-x');
      const busy = await screen.findByRole('button', { name: '停止中…' });
      expect(busy).toBeDisabled();

      await act(async () => done());
      expect(screen.getByRole('button', { name: '停止' })).toBeEnabled();
    });

    it('確認で止めたら何もしない', () => {
      vi.spyOn(window, 'confirm').mockReturnValue(false);
      const onStop = vi.fn();
      panel(ok([codespace({ display_name: null, name: 'n' })]), { onStop });
      fireEvent.click(screen.getByRole('button', { name: '停止' }));
      expect(window.confirm).toHaveBeenCalledWith('n を停止しますか？');
      expect(onStop).not.toHaveBeenCalled();
    });

    it.each([
      [
        new Error('静的プレビューでは停止できません'),
        '静的プレビューでは停止できません',
      ],
      ['raw', 'raw'],
    ])('失敗したら理由を出す（%s）', async (err, text) => {
      vi.spyOn(window, 'confirm').mockReturnValue(true);
      panel(ok([codespace()]), { onStop: vi.fn().mockRejectedValue(err) });
      fireEvent.click(screen.getByRole('button', { name: '停止' }));
      expect(await screen.findByText(`⚠️ ${text}`)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: '停止' })).toBeEnabled();
    });
  });
});
