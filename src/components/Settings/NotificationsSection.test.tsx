import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { type PushStatus, usePush } from '@/hooks/usePush';
import { NotificationsSection } from './NotificationsSection';

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

beforeEach(() => {
  for (const f of Object.values(push)) {
    f.mockReset();
  }
  mockPush('off');
});

describe('NotificationsSection', () => {
  it('確認中はボタンを出さない', () => {
    mockPush('loading');
    render(<NotificationsSection />);
    expect(screen.getByText('確認中…')).toBeInTheDocument();
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('オフなら有効化ボタン', () => {
    render(<NotificationsSection />);
    expect(screen.getByText('通知オフ')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '通知を有効化' }));
    expect(push.subscribe).toHaveBeenCalled();
  });

  it('オンならテスト通知とオフにするボタン', () => {
    mockPush('on');
    render(<NotificationsSection />);
    expect(screen.getByText('通知オン')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'テスト通知' }));
    expect(push.sendTest).toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: '通知をオフにする' }));
    expect(push.unsubscribe).toHaveBeenCalled();
  });

  it.each(['on', 'off'] as const)(
    '%s で処理中は押せず、エラーを出す',
    (status) => {
      mockPush(status, { busy: true, error: '登録に失敗' });
      render(<NotificationsSection />);
      for (const b of screen.getAllByRole('button')) {
        expect(b).toBeDisabled();
      }
      expect(screen.getByText('登録に失敗')).toBeInTheDocument();
    },
  );

  it.each([
    ['needs-install', 'smartphone', 'ホーム画面に追加'],
    ['unsupported', 'bellOff', 'このブラウザはプッシュ通知に対応していません'],
    ['disabled', 'bellOff', 'サーバー側でプッシュ通知が設定されていません'],
    ['denied', 'bellOff', 'ブラウザの設定で通知がブロックされています'],
  ] as const)('%s なら理由を案内する', (status, icon, hint) => {
    mockPush(status);
    const { container } = render(<NotificationsSection />);
    expect(container.querySelector(`svg[data-icon="${icon}"]`)).not.toBeNull();
    expect(screen.getByText(new RegExp(hint))).toBeInTheDocument();
    expect(screen.queryByRole('button')).toBeNull();
  });
});
