import clsx from 'clsx';
import { useEffect, useId, useRef, useState } from 'react';
import {
  DEBUG_SECTION_STATES,
  type DebugSectionState,
  type DebugSettings,
  EMPTY_DEBUG,
  SAMPLE_DEBUG,
  type Settings,
} from '@/hooks/useSettings';
import type { ResolvedPlans } from '@/lib/debug';
import {
  COPILOT_PLAN_KEYS,
  COPILOT_PLANS,
  GITHUB_PLAN_KEYS,
  GITHUB_PLANS,
  WORKERS_PLAN_KEYS,
  WORKERS_PLANS,
} from '@/lib/plans';
import { IS_STATIC_PREVIEW } from '@/lib/preview';
import {
  actions,
  control,
  group,
  legend,
  popover,
  row,
  rowHint,
  scroll,
  smallBtn,
  switchRow,
  tab,
  tabDebugOn,
  tabs,
  trigger,
  wrap,
} from './style.css';

interface Props {
  settings: Settings;
  plans: ResolvedPlans;
  onChange: (patch: Partial<Settings>) => void;
  onChangeDebug: (patch: Partial<DebugSettings>) => void;
}

type Tab = 'general' | 'debug';

const STATE_LABEL: Record<DebugSectionState, string> = {
  '': '実データどおり',
  unconfigured: '未設定',
  forbidden: '権限不足',
  error: '取得エラー',
};

const NumberRow = ({
  label,
  hint,
  value,
  onChange,
  step = 'any',
}: {
  label: string;
  hint?: string;
  value: string;
  onChange: (v: string) => void;
  step?: string;
}) => {
  const id = useId();
  return (
    <div className={row}>
      <label htmlFor={id}>
        {label}
        {hint && <span className={rowHint}>{hint}</span>}
      </label>
      <input
        id={id}
        className={control}
        type="number"
        inputMode="decimal"
        min={0}
        step={step}
        placeholder={IS_STATIC_PREVIEW ? '0' : '実データ'}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
};

const SelectRow = <T extends string>({
  label,
  hint,
  value,
  options,
  onChange,
}: {
  label: string;
  hint?: string;
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
}) => {
  const id = useId();
  return (
    <div className={row}>
      <label htmlFor={id}>
        {label}
        {hint && <span className={rowHint}>{hint}</span>}
      </label>
      <select
        id={id}
        className={control}
        value={value}
        onChange={(e) => onChange(e.target.value as T)}
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  );
};

const GeneralTab = ({
  settings,
  plans,
  onChange,
}: Omit<Props, 'onChangeDebug'>) => (
  <>
    <div className={group}>
      <p className={legend}>契約プラン（無料枠・上限の計算に使う）</p>
      <SelectRow
        label="GitHub"
        hint={
          settings.githubPlan === 'auto'
            ? `API から判定: ${GITHUB_PLANS[plans.githubDetected].label}`
            : undefined
        }
        value={settings.githubPlan}
        options={[
          { value: 'auto', label: '自動' },
          ...GITHUB_PLAN_KEYS.map((k) => ({
            value: k,
            label: GITHUB_PLANS[k].label,
          })),
        ]}
        onChange={(v) => onChange({ githubPlan: v })}
      />
      <SelectRow
        label="Cloudflare Workers"
        hint={
          settings.workersPlan === 'auto'
            ? `API から推定: ${WORKERS_PLANS[plans.workersDetected].label}`
            : undefined
        }
        value={settings.workersPlan}
        options={[
          { value: 'auto', label: '自動' },
          ...WORKERS_PLAN_KEYS.map((k) => ({
            value: k,
            label: WORKERS_PLANS[k].label,
          })),
        ]}
        onChange={(v) => onChange({ workersPlan: v })}
      />
      <SelectRow
        label="Copilot"
        hint="API で取れないので手動"
        value={settings.copilotPlan}
        options={COPILOT_PLAN_KEYS.map((k) => ({
          value: k,
          label: COPILOT_PLANS[k].label,
        }))}
        onChange={(v) => onChange({ copilotPlan: v })}
      />
    </div>
  </>
);

const DebugTab = ({
  debug,
  onChangeDebug,
}: {
  debug: DebugSettings;
  onChangeDebug: Props['onChangeDebug'];
}) => {
  const on = debug.enabled;
  const fallback = { value: '' as const, label: '設定どおり' };
  return (
    <>
      <label className={switchRow}>
        <span>
          デバッグモード（ロゴ横に DEBUG）
          {IS_STATIC_PREVIEW && (
            <span className={rowHint}>静的プレビューでは常にオン</span>
          )}
        </span>
        <input
          type="checkbox"
          checked={on}
          disabled={IS_STATIC_PREVIEW}
          onChange={(e) => onChangeDebug({ enabled: e.target.checked })}
        />
      </label>

      <fieldset className={group} disabled={!on}>
        <p className={legend}>取得状態を上書き</p>
        <SelectRow<DebugSectionState>
          label="全項目"
          hint="取れなかったときの表示を確認する"
          value={debug.sectionState}
          options={DEBUG_SECTION_STATES.map((v) => ({
            value: v,
            label: STATE_LABEL[v],
          }))}
          onChange={(v) => onChangeDebug({ sectionState: v })}
        />
      </fieldset>

      <fieldset className={group} disabled={!on}>
        <p className={legend}>プランを上書き</p>
        <SelectRow
          label="GitHub"
          value={debug.githubPlan}
          options={[
            fallback,
            ...GITHUB_PLAN_KEYS.map((k) => ({
              value: k,
              label: GITHUB_PLANS[k].label,
            })),
          ]}
          onChange={(v) => onChangeDebug({ githubPlan: v })}
        />
        <SelectRow
          label="Cloudflare Workers"
          value={debug.workersPlan}
          options={[
            fallback,
            ...WORKERS_PLAN_KEYS.map((k) => ({
              value: k,
              label: WORKERS_PLANS[k].label,
            })),
          ]}
          onChange={(v) => onChangeDebug({ workersPlan: v })}
        />
        <SelectRow
          label="Copilot"
          value={debug.copilotPlan}
          options={[
            fallback,
            ...COPILOT_PLAN_KEYS.map((k) => ({
              value: k,
              label: COPILOT_PLANS[k].label,
            })),
          ]}
          onChange={(v) => onChangeDebug({ copilotPlan: v })}
        />
      </fieldset>

      <fieldset className={group} disabled={!on}>
        <p className={legend}>
          {IS_STATIC_PREVIEW
            ? '疑似的な使用量'
            : '疑似的な使用量（空欄 = 実データ）'}
        </p>
        <NumberRow
          label="Codespaces"
          hint="2コア換算の時間"
          value={debug.codespacesHours}
          onChange={(v) => onChangeDebug({ codespacesHours: v })}
        />
        <NumberRow
          label="Codespaces ストレージ"
          hint="GB-月"
          value={debug.codespacesStorageGb}
          onChange={(v) => onChangeDebug({ codespacesStorageGb: v })}
        />
        <NumberRow
          label="Actions"
          hint="Linux換算の分"
          step="1"
          value={debug.actionsMinutes}
          onChange={(v) => onChangeDebug({ actionsMinutes: v })}
        />
        <NumberRow
          label="Workers Builds"
          hint="ビルド時間（分）"
          step="1"
          value={debug.workersMinutes}
          onChange={(v) => onChangeDebug({ workersMinutes: v })}
        />
        <NumberRow
          label="Copilot"
          hint="AI Credits 使用額（USD）"
          value={debug.copilotUsd}
          onChange={(v) => onChangeDebug({ copilotUsd: v })}
        />
        <div className={actions}>
          <button
            type="button"
            className={smallBtn}
            onClick={() => onChangeDebug(SAMPLE_DEBUG)}
          >
            サンプル値を入れる
          </button>
          <button
            type="button"
            className={smallBtn}
            onClick={() => onChangeDebug({ ...EMPTY_DEBUG, enabled: true })}
          >
            クリア
          </button>
        </div>
      </fieldset>
    </>
  );
};

export const SettingsMenu = (props: Props) => {
  const { settings, onChangeDebug } = props;
  const [open, setOpen] = useState(false);
  const [current, setCurrent] = useState<Tab>('general');
  const ref = useRef<HTMLDivElement>(null);
  const panelId = useId();
  const tabId = useId();

  useEffect(() => {
    if (!open) {
      return;
    }
    const onDown = (e: PointerEvent) => {
      if (!ref.current?.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpen(false);
      }
    };
    document.addEventListener('pointerdown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const TABS: { key: Tab; label: string }[] = [
    { key: 'general', label: '設定' },
    { key: 'debug', label: settings.debug.enabled ? 'デバッグ ●' : 'デバッグ' },
  ];

  return (
    <div className={wrap} ref={ref}>
      <button
        type="button"
        className={trigger}
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-controls={panelId}
        title="設定"
      >
        ⚙
      </button>
      {open && (
        <div id={panelId} className={popover} role="dialog" aria-label="設定">
          <div className={tabs} role="tablist">
            {TABS.map((t) => (
              <button
                key={t.key}
                type="button"
                role="tab"
                id={`${tabId}-${t.key}`}
                aria-selected={current === t.key}
                aria-controls={`${tabId}-${t.key}-panel`}
                className={clsx(
                  tab,
                  t.key === 'debug' && settings.debug.enabled && tabDebugOn,
                )}
                onClick={() => setCurrent(t.key)}
              >
                {t.label}
              </button>
            ))}
          </div>
          <div
            className={scroll}
            role="tabpanel"
            id={`${tabId}-${current}-panel`}
            aria-labelledby={`${tabId}-${current}`}
          >
            {current === 'general' ? (
              <GeneralTab {...props} />
            ) : (
              <DebugTab debug={settings.debug} onChangeDebug={onChangeDebug} />
            )}
          </div>
        </div>
      )}
    </div>
  );
};
