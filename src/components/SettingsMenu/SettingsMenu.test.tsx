import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { EMPTY_DEBUG, SAMPLE_DEBUG, type Settings } from '@/hooks/useSettings';
import type { ResolvedPlans } from '@/lib/debug';
import { setPreview } from '@/testing/previewMock';
import { SettingsMenu } from './SettingsMenu';
import { tabDebugOn } from './style.css';

vi.mock('@/lib/preview', () =>
  import('@/testing/previewMock').then((m) => m.previewModule),
);

const base: Settings = {
  githubPlan: 'auto',
  copilotPlan: 'pro',
  workersPlan: 'auto',
  serviceTab: 'github',
  debug: EMPTY_DEBUG,
};

const plans: ResolvedPlans = {
  github: 'pro',
  githubDetected: 'pro',
  copilot: 'pro',
  workers: 'paid',
  workersDetected: 'paid',
};

const menu = (settings: Partial<Settings> = {}) => {
  const onChange = vi.fn();
  const onChangeDebug = vi.fn();
  const r = render(
    <div>
      <SettingsMenu
        settings={{ ...base, ...settings }}
        plans={plans}
        onChange={onChange}
        onChangeDebug={onChangeDebug}
      />
      <p>外側</p>
    </div>,
  );
  return { ...r, onChange, onChangeDebug };
};

const open = () =>
  fireEvent.click(screen.getByRole('button', { name: '設定' }));
const toDebug = () =>
  fireEvent.click(screen.getByRole('tab', { name: /デバッグ/ }));

describe('SettingsMenu', () => {
  describe('開閉', () => {
    it('ボタンで開閉する', () => {
      menu();
      const trigger = screen.getByRole('button', { name: '設定' });
      expect(trigger).toHaveAttribute('aria-expanded', 'false');
      expect(screen.queryByRole('dialog')).toBeNull();

      open();
      expect(trigger).toHaveAttribute('aria-expanded', 'true');
      const dialog = screen.getByRole('dialog', { name: '設定' });
      expect(trigger).toHaveAttribute('aria-controls', dialog.id);

      open();
      expect(screen.queryByRole('dialog')).toBeNull();
    });

    it('外側を押したら閉じる（中を押しても閉じない）', () => {
      menu();
      open();
      fireEvent.pointerDown(screen.getByRole('dialog'));
      expect(screen.getByRole('dialog')).toBeInTheDocument();
      fireEvent.pointerDown(screen.getByText('外側'));
      expect(screen.queryByRole('dialog')).toBeNull();
    });

    it('Escape で閉じる（ほかのキーでは閉じない）', () => {
      menu();
      open();
      fireEvent.keyDown(document, { key: 'Enter' });
      expect(screen.getByRole('dialog')).toBeInTheDocument();
      fireEvent.keyDown(document, { key: 'Escape' });
      expect(screen.queryByRole('dialog')).toBeNull();
    });

    it('閉じたら外側のイベントを見ない', () => {
      const remove = vi.spyOn(document, 'removeEventListener');
      menu();
      open();
      open();
      expect(remove).toHaveBeenCalledWith('pointerdown', expect.any(Function));
      expect(remove).toHaveBeenCalledWith('keydown', expect.any(Function));
    });
  });

  describe('タブ', () => {
    it('設定タブから始まり、デバッグタブに切り替えられる', () => {
      menu();
      open();
      const [general, debug] = screen.getAllByRole('tab');
      expect(general).toHaveAttribute('aria-selected', 'true');
      expect(screen.getByRole('tabpanel')).toHaveAttribute(
        'aria-labelledby',
        general.id,
      );
      fireEvent.click(debug);
      expect(debug).toHaveAttribute('aria-selected', 'true');
      expect(screen.getByRole('tabpanel')).toHaveAttribute(
        'aria-labelledby',
        debug.id,
      );
      expect(screen.getByRole('checkbox')).toBeInTheDocument();

      fireEvent.click(general);
      expect(screen.queryByRole('checkbox')).toBeNull();
    });

    it('デバッグ中はタブに印を付ける', () => {
      menu({ debug: { ...EMPTY_DEBUG, enabled: true } });
      open();
      const debug = screen.getByRole('tab', { name: 'デバッグ ●' });
      expect(debug).toHaveClass(tabDebugOn);
      expect(screen.getByRole('tab', { name: '設定' })).not.toHaveClass(
        tabDebugOn,
      );
    });

    it('デバッグでなければ印はない', () => {
      menu();
      open();
      expect(screen.getByRole('tab', { name: 'デバッグ' })).not.toHaveClass(
        tabDebugOn,
      );
    });
  });

  describe('設定タブ', () => {
    it('自動のときは判定したプランを添える', () => {
      menu();
      open();
      expect(screen.getByLabelText(/^GitHub/)).toHaveValue('auto');
      expect(screen.getByText('API から判定: GitHub Pro')).toBeInTheDocument();
      expect(
        screen.getByText('API から推定: Workers Paid'),
      ).toBeInTheDocument();
    });

    it('手動で選んでいれば判定は出さない', () => {
      menu({ githubPlan: 'free', workersPlan: 'free' });
      open();
      expect(screen.queryByText(/API から/)).toBeNull();
    });

    it('プランを変えられる', () => {
      const { onChange } = menu();
      open();
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

  describe('デバッグタブ', () => {
    it('オフのときは上書きの項目を触れない', () => {
      const { onChangeDebug } = menu();
      open();
      toDebug();
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
      const debug = { ...EMPTY_DEBUG, enabled: true, actionsMinutes: '12' };
      const { onChangeDebug } = menu({ debug });
      open();
      toDebug();
      for (const fs of screen.getAllByRole('group')) {
        expect(fs).toBeEnabled();
      }
      expect(screen.getByLabelText(/^ActionsLinux/)).toHaveValue(12);
      expect(screen.getByLabelText(/^ActionsLinux/)).toHaveAttribute(
        'step',
        '1',
      );
      expect(screen.getByLabelText(/^CopilotAI/)).toHaveAttribute(
        'step',
        'any',
      );

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
      const { onChangeDebug } = menu({
        debug: { ...EMPTY_DEBUG, enabled: true },
      });
      open();
      toDebug();
      fireEvent.click(
        screen.getByRole('button', { name: 'サンプル値を入れる' }),
      );
      fireEvent.click(screen.getByRole('button', { name: 'クリア' }));
      expect(onChangeDebug.mock.calls).toEqual([
        [SAMPLE_DEBUG],
        [{ ...EMPTY_DEBUG, enabled: true }],
      ]);
    });

    it('静的プレビューではデバッグを切れない', () => {
      setPreview(true);
      menu({ debug: { ...EMPTY_DEBUG, enabled: true } });
      open();
      toDebug();
      expect(screen.getByRole('checkbox')).toBeDisabled();
      expect(
        screen.getByText('静的プレビューでは常にオン'),
      ).toBeInTheDocument();
      expect(screen.getByText('疑似的な使用量')).toBeInTheDocument();
      expect(screen.getByLabelText(/^Codespaces2コア/)).toHaveAttribute(
        'placeholder',
        '0',
      );
    });
  });
});
