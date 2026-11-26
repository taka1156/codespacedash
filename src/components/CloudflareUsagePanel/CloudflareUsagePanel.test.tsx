import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { CloudflareUsagePanel } from './CloudflareUsagePanel';

const items = [
  { key: 'a', label: 'A 読み取り', free: 1000, unit: '回' },
  { key: 'b', label: 'B 書き込み', free: 100, unit: '回' },
  { key: 'c', label: 'C', free: 10, unit: 'GB' },
] as const;

const panel = (
  values?: Parameters<typeof CloudflareUsagePanel>[0]['values'],
  note?: string,
) =>
  render(
    <CloudflareUsagePanel
      title="日次の無料枠"
      icon="◷"
      subTitle="毎日リセット"
      items={items}
      values={values}
      note={note}
    />,
  );

describe('CloudflareUsagePanel', () => {
  it('項目ごとに使用量のバーを出す', () => {
    const { container } = panel(
      {
        a: { status: 'ok', data: 250 },
        b: { status: 'ok', data: 90 },
        c: { status: 'ok', data: 0.5 },
      },
      '注記',
    );
    expect(screen.getByRole('heading')).toHaveTextContent('◷ 日次の無料枠');
    expect(container).toHaveTextContent('毎日リセット');
    expect(container).toHaveTextContent('A 読み取り使用 250 / 1,000 回 ・ 25%');
    expect(container).toHaveTextContent('B 書き込み使用 90 / 100 回 ・ 90%');
    expect(container).toHaveTextContent('C使用 0.50 / 10 GB ・ 5%');
    expect(screen.getByText('注記')).toBeInTheDocument();
    expect(screen.queryByRole('list')).toBeNull();
  });

  it('値がまだなければ「未対応」、注記は省略できる', () => {
    const { container } = panel(undefined);
    expect(container).toHaveTextContent('A 読み取り未対応 ・ 枠 1,000 回');
    expect(container.querySelectorAll('p')).toHaveLength(1);
  });

  it('取れなかった項目は理由を出し、エラーの内容をまとめる', () => {
    const { container } = panel({
      a: {
        status: 'forbidden',
        permission: 'Account Analytics: Read',
        message: 'not authorized',
      },
      b: { status: 'error', message: 'unknown field' },
      c: { status: 'unconfigured', setting: 'X' },
    });
    expect(container).toHaveTextContent('A 読み取り権限不足 ・ 枠');
    expect(container).toHaveTextContent('B 書き込み取得失敗 ・ 枠');
    expect(container).toHaveTextContent('C未設定 ・ 枠');
    const li = screen.getAllByRole('listitem').map((l) => l.textContent);
    expect(li).toEqual([
      '🔒 トークンに Account Analytics: Read を付けてください',
      'A 読み取り: not authorized',
      'B 書き込み: unknown field',
    ]);
  });

  it('全項目が同じ理由なら1行にまとめる', () => {
    const e = { status: 'error' as const, message: 'GraphQL 502' };
    panel({ a: e, b: e });
    expect(screen.getAllByRole('listitem').map((l) => l.textContent)).toEqual([
      'GraphQL 502',
    ]);
  });
});
