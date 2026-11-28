import { useId } from 'react';
import {
  DEBUG_SECTION_STATES,
  DEBUG_SERVICE_STATUSES,
  type DebugSectionState,
  type DebugServiceStatus,
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
import { STATUS_LABEL } from '@/lib/serviceStatus';
import {
  actions,
  control,
  group,
  legend,
  row,
  rowHint,
  smallBtn,
  switchRow,
} from './style.css';

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
  hint: string;
  value: string;
  onChange: (v: string) => void;
  step?: string;
}) => {
  const id = useId();
  return (
    <div className={row}>
      <label htmlFor={id}>
        {label}
        <span className={rowHint}>{hint}</span>
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

/** 設定ページの「プラン」：無料枠・上限の計算に使う契約プラン */
export const PlansSection = ({
  settings,
  plans,
  onChange,
}: {
  settings: Settings;
  plans: ResolvedPlans;
  onChange: (patch: Partial<Settings>) => void;
}) => (
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

/** 設定ページの「デバッグ」：疑似値や取得状態で見た目を確かめる */
export const DebugSection = ({
  debug,
  onChangeDebug,
}: {
  debug: DebugSettings;
  onChangeDebug: (patch: Partial<DebugSettings>) => void;
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
        <SelectRow<DebugServiceStatus>
          label="サービスの障害"
          hint="見ているコンポーネントをすべてこの状態にする"
          value={debug.serviceStatus}
          options={DEBUG_SERVICE_STATUSES.map((v) => ({
            value: v,
            label: v ? STATUS_LABEL[v] : '実データどおり',
          }))}
          onChange={(v) => onChangeDebug({ serviceStatus: v })}
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
        <NumberRow
          label="GitHub トークン"
          hint="期限までの日数（0 で期限切れ）"
          step="1"
          value={debug.githubTokenDays}
          onChange={(v) => onChangeDebug({ githubTokenDays: v })}
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
