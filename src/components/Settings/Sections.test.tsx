import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { EMPTY_DEBUG, SAMPLE_DEBUG, type Settings } from '@/hooks/useSettings';
import type { ResolvedPlans } from '@/lib/debug';
import { setPreview } from '@/testing/previewMock';
import { DebugSection, PlansSection } from './Sections';

vi.mock('@/lib/preview', () =>
  import('@/testing/previewMock').then((m) => m.previewModule),
);

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

const plansSection = (settings: Partial<Settings> = {}) => {
  const onChange = vi.fn();
  render(
    <PlansSection
      settings={{ ...base, ...settings }}
      plans={plans}
      onChange={onChange}
    />,
  );
  return { onChange };
};

const debugSection = (debug: Partial<Settings['debug']> = {}) => {
  const onChangeDebug = vi.fn();
  render(
    <DebugSection
      debug={{ ...EMPTY_DEBUG, ...debug }}
      onChangeDebug={onChangeDebug}
    />,
  );
  return { onChangeDebug };
};

describe('PlansSection', () => {
  it('自動のときは判定したプランを添える', () => {
    plansSection();
    expect(screen.getByLabelText(/^GitHub/)).toHaveValue('auto');
    expect(screen.getByText('API から判定: GitHub Pro')).toBeInTheDocument();
    expect(screen.getByText('API から推定: Workers Paid')).toBeInTheDocument();
  });

  it('手動で選んでいれば判定は出さない', () => {
    plansSection({ githubPlan: 'free', workersPlan: 'free' });
    expect(screen.queryByText(/API から/)).toBeNull();
  });

  it('プランを変えられる', () => {
    const { onChange } = plansSection();
    fireEvent.change(screen.getByLabelText(/^GitHub/), {
      target: { value: 'pro' },
    });
    fireEvent.change(screen.getByLabelText(/^Cloudflare Workers/), {
      target: { value: 'paid' },
    });
    fireEvent.change(screen.getByLabelText(/^Copilot/), {
      target: { value: 'pro_plus' },
    });
    expect(onChange.mock.calls).toEqual([
      [{ githubPlan: 'pro' }],
      [{ workersPlan: 'paid' }],
      [{ copilotPlan: 'pro_plus' }],
    ]);
    expect(
      within(screen.getByLabelText(/^Copilot/))
        .getAllByRole('option')
        .map((o) => o.textContent),
    ).toEqual(['Copilot Free', 'Copilot Pro', 'Copilot Pro+']);
  });
});

describe('DebugSection', () => {
  it('オフのときは上書きの項目を触れない', () => {
    const { onChangeDebug } = debugSection();
    const box = screen.getByRole('checkbox');
    expect(box).not.toBeChecked();
    expect(box).toBeEnabled();
    for (const fs of screen.getAllByRole('group')) {
      expect(fs).toBeDisabled();
    }
    expect(screen.getByLabelText(/^Codespaces2コア/)).toHaveAttribute(
      'placeholder',
      '実データ',
    );
    expect(
      screen.getByText('疑似的な使用量（空欄 = 実データ）'),
    ).toBeInTheDocument();

    fireEvent.click(box);
    expect(onChangeDebug).toHaveBeenCalledWith({ enabled: true });
  });

  it('オンのときは各項目を上書きできる', () => {
    const { onChangeDebug } = debugSection({
      enabled: true,
      actionsMinutes: '12',
    });
    for (const fs of screen.getAllByRole('group')) {
      expect(fs).toBeEnabled();
    }
    expect(screen.getByLabelText(/^ActionsLinux/)).toHaveValue(12);
    expect(screen.getByLabelText(/^ActionsLinux/)).toHaveAttribute('step', '1');
    expect(screen.getByLabelText(/^CopilotAI/)).toHaveAttribute('step', 'any');

    const select = (name: RegExp, value: string) =>
      fireEvent.change(screen.getByRole('combobox', { name }), {
        target: { value },
      });
    select(/^全項目/, 'forbidden');
    select(/^GitHub/, 'pro');
    select(/^Cloudflare Workers/, 'paid');
    select(/^Copilot/, 'free');

    const num = (label: RegExp, value: string) =>
      fireEvent.change(screen.getByLabelText(label), { target: { value } });
    num(/^Codespaces2コア/, '1');
    num(/^Codespaces ストレージ/, '2');
    num(/^ActionsLinux/, '3');
    num(/^Workers Builds/, '4');
    num(/^CopilotAI/, '5');
    num(/^GitHub トークン/, '6');

    expect(onChangeDebug.mock.calls).toEqual([
      [{ sectionState: 'forbidden' }],
      [{ githubPlan: 'pro' }],
      [{ workersPlan: 'paid' }],
      [{ copilotPlan: 'free' }],
      [{ codespacesHours: '1' }],
      [{ codespacesStorageGb: '2' }],
      [{ actionsMinutes: '3' }],
      [{ workersMinutes: '4' }],
      [{ copilotUsd: '5' }],
      [{ githubTokenDays: '6' }],
    ]);
    expect(
      within(screen.getByRole('combobox', { name: /^全項目/ }))
        .getAllByRole('option')
        .map((o) => o.textContent),
    ).toEqual(['実データどおり', '未設定', '権限不足', '取得エラー']);
    expect(
      within(screen.getByRole('combobox', { name: /^GitHub/ }))
        .getAllByRole('option')
        .map((o) => o.textContent),
    ).toEqual(['設定どおり', 'GitHub Free', 'GitHub Pro']);
  });

  it('サンプル値を入れる・クリアする', () => {
    const { onChangeDebug } = debugSection({ enabled: true });
    fireEvent.click(screen.getByRole('button', { name: 'サンプル値を入れる' }));
    fireEvent.click(screen.getByRole('button', { name: 'クリア' }));
    expect(onChangeDebug.mock.calls).toEqual([
      [SAMPLE_DEBUG],
      [{ ...EMPTY_DEBUG, enabled: true }],
    ]);
  });

  it('静的プレビューではデバッグを切れない', () => {
    setPreview(true);
    debugSection({ enabled: true });
    expect(screen.getByRole('checkbox')).toBeDisabled();
    expect(screen.getByText('静的プレビューでは常にオン')).toBeInTheDocument();
    expect(screen.getByText('疑似的な使用量')).toBeInTheDocument();
    expect(screen.getByLabelText(/^Codespaces2コア/)).toHaveAttribute(
      'placeholder',
      '0',
    );
  });
});
