import { act, fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { usePush } from '@/hooks/usePush';
import type { SettingsSection } from '@/hooks/useRoute';
import { EMPTY_DEBUG, type Settings } from '@/hooks/useSettings';
import { api } from '@/lib/api';
import type { ResolvedPlans } from '@/lib/debug';
import { dashboard } from '@/testing/fixtures';
import { setPreview } from '@/testing/previewMock';
import { SettingsPage } from './SettingsPage';
import { navDebugOn } from './style.css';

vi.mock('@/lib/preview', () =>
  import('@/testing/previewMock').then((m) => m.previewModule),
);
vi.mock('@/hooks/usePush', () => ({ usePush: vi.fn() }));
vi.mock('@/lib/api', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/api')>()),
  api: { get: vi.fn(), post: vi.fn(), delete: vi.fn() },
}));

const base: Settings = {
  githubPlan: 'auto',
  copilotPlan: 'pro',
  workersPlan: 'auto',
  serviceTab: 'github',
  favorites: [],
  debug: EMPTY_DEBUG,
};

const plans: ResolvedPlans = {
  github: 'pro',
  githubDetected: 'pro',
  copilot: 'pro',
  workers: 'paid',
  workersDetected: 'paid',
};

type PageProps = Parameters<typeof SettingsPage>[0];

/** 親（DashboardPage）の代わりに、選んだ項目を覚える */
const Harness = ({
  initial,
  ...props
}: Omit<PageProps, 'section'> & { initial: SettingsSection }) => {
  const [section, setSection] = useState(initial);
  return (
    <SettingsPage
      {...props}
      section={section}
      onSection={(s) => {
        props.onSection(s);
        setSection(s);
      }}
    />
  );
};

const page = (
  p: {
    section?: SettingsSection;
    settings?: Partial<Settings>;
    tokenAlert?: boolean;
  } = {},
) => {
  const onChange = vi.fn();
  const onChangeDebug = vi.fn();
  const onSection = vi.fn();
  render(
    <Harness
      initial={p.section ?? 'plans'}
      onSection={onSection}
      settings={{ ...base, ...p.settings }}
      plans={plans}
      tokens={dashboard().tokens}
      tokenAlert={p.tokenAlert ?? false}
      onChange={onChange}
      onChangeDebug={onChangeDebug}
    />,
  );
  return { onChange, onChangeDebug, onSection };
};

const tabs = () => screen.getAllByRole('tab').map((t) => t.textContent);

beforeEach(() => {
  vi.mocked(usePush).mockReturnValue({
    status: 'off',
    busy: false,
    error: null,
    subscribe: vi.fn(),
    unsubscribe: vi.fn(),
    sendTest: vi.fn(),
  });
});

describe('SettingsPage', () => {
  it('ダッシュボードへ戻るリンクと項目のメニューを出す', () => {
    page();
    expect(screen.getByRole('heading', { name: '設定' })).toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: /ダッシュボード/ }),
    ).toHaveAttribute('href', '#/');
    expect(tabs()).toEqual([
      'プラン',
      'お気に入り',
      'トークン',
      '通知',
      'デバッグ',
    ]);
    const plansTab = screen.getByRole('tab', { name: 'プラン' });
    expect(plansTab).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('tabpanel')).toHaveAttribute(
      'aria-labelledby',
      plansTab.id,
    );
    expect(plansTab).toHaveAttribute(
      'aria-controls',
      screen.getByRole('tabpanel').id,
    );
  });

  it('項目を切り替えて中身を出す', async () => {
    vi.mocked(api.get).mockResolvedValue({ repos: { status: 'ok', data: [] } });
    const { onSection, onChange } = page({
      settings: { favorites: ['me/app'] },
    });

    fireEvent.click(screen.getByRole('tab', { name: 'トークン' }));
    expect(onSection).toHaveBeenLastCalledWith('tokens');
    expect(screen.getByText('API トークンの期限')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('tab', { name: '通知' }));
    expect(screen.getByText('この端末のプッシュ通知')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('tab', { name: 'デバッグ' }));
    expect(screen.getByRole('checkbox')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('tab', { name: 'お気に入り' }));
    fireEvent.click(screen.getByRole('button', { name: 'me/app を削除' }));
    expect(onChange).toHaveBeenCalledWith({ favorites: [] });
    await act(async () => {});

    fireEvent.click(screen.getByRole('tab', { name: 'プラン' }));
    expect(screen.getByLabelText(/^GitHub/)).toHaveValue('auto');
  });

  it('期限が近いトークンがあればメニューに点を付ける', () => {
    page({ tokenAlert: true, section: 'tokens' });
    expect(
      screen.getByRole('tab', { name: 'トークン' }).querySelector('span'),
    ).toHaveAttribute('title', '要確認');
  });

  it('点がなければ付けない', () => {
    page();
    expect(screen.queryByTitle('要確認')).toBeNull();
  });

  it('デバッグ中はメニューに印を付ける', () => {
    page({ settings: { debug: { ...EMPTY_DEBUG, enabled: true } } });
    expect(screen.getByRole('tab', { name: 'デバッグ ●' })).toHaveClass(
      navDebugOn,
    );
    expect(screen.getByRole('tab', { name: 'プラン' })).not.toHaveClass(
      navDebugOn,
    );
  });

  it('デバッグでなければ印はない', () => {
    page();
    expect(screen.getByRole('tab', { name: 'デバッグ' })).not.toHaveClass(
      navDebugOn,
    );
  });

  it('静的プレビューでは通知の項目を出さず、開こうとしてもプランにする', () => {
    setPreview(true);
    page({ section: 'notifications' });
    expect(tabs()).toEqual(['プラン', 'お気に入り', 'トークン', 'デバッグ']);
    expect(screen.getByRole('tab', { name: 'プラン' })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    expect(usePush).not.toHaveBeenCalled();
  });
});
