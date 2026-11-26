import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { BasePanel } from './BasePanel';

describe('BasePanel', () => {
  it('タイトル・サブタイトル・バッジと中身を出す', () => {
    render(
      <BasePanel
        title="Codespaces"
        subTitle="今月"
        icon="🧑‍💻"
        badgeText="2 台"
      >
        <p>中身</p>
      </BasePanel>,
    );
    expect(
      screen.getByRole('heading', { name: '🧑‍💻 Codespaces' }),
    ).toBeInTheDocument();
    expect(screen.getByText('今月')).toBeInTheDocument();
    expect(screen.getByText('2 台')).toBeInTheDocument();
    expect(screen.getByText('中身')).toBeInTheDocument();
  });

  it('サブタイトルとバッジは省略できる', () => {
    const { container } = render(
      <BasePanel title="T" icon="i">
        x
      </BasePanel>,
    );
    // 見出しのブロックとバッジがないので、ヘッダーの子は1つだけ
    expect(container.querySelector('section > div')?.children).toHaveLength(1);
    expect(container.querySelector('h2 + p')).toBeNull();
  });
});
