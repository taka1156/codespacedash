import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { StatusNote } from './StatusNote';

describe('StatusNote', () => {
  it('未設定は足りない設定名を案内する', () => {
    const { container } = render(
      <StatusNote
        state={{ status: 'unconfigured', setting: 'GITHUB_TOKEN' }}
        what="実行履歴"
      />,
    );
    expect(container).toHaveTextContent('実行履歴は未設定です');
    expect(container.querySelector('code')).toHaveTextContent('GITHUB_TOKEN');
  });

  it('権限不足は足りない権限名とエラー内容を出す', () => {
    const { container } = render(
      <StatusNote
        state={{
          status: 'forbidden',
          permission: 'Plan: Read',
          message: 'GitHub API 403',
        }}
        what="使用量"
      />,
    );
    expect(container).toHaveTextContent('🔒 使用量を見る権限が足りません');
    expect(container.querySelector('code')).toHaveTextContent('Plan: Read');
    expect(container).toHaveTextContent('GitHub API 403');
  });

  it('エラーは内容を出す', () => {
    const { container } = render(
      <StatusNote state={{ status: 'error', message: 'boom' }} what="一覧" />,
    );
    expect(container).toHaveTextContent('⚠ 一覧を取得できませんでした');
    expect(container).toHaveTextContent('boom');
  });
});
