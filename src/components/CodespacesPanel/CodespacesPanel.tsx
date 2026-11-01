import clsx from 'clsx';
import { useState } from 'react';
import { codespacesQuota } from '@/lib/codespacesQuota';
import type { BillingUsageSummary, Codespace } from '@/lib/types';
import { BasePanel } from '../shared/BasePanel/BasePanel';
import {
  csActions,
  csBtn,
  csBtnDanger,
  csDetail,
  csDetailSpan,
  csItem,
  csItemForgotten,
  csList,
  csMeta,
  csName,
  csRepo,
  csTime,
  csTop,
  csWarn,
  emptyState,
  quotaBox,
  quotaFill,
  quotaHead,
  quotaLow,
  quotaOk,
  quotaRow,
  quotaTrack,
  quotaValue,
  stateAvailable,
  stateAvailableBadge,
  stateBadge,
  stateDot,
  stateFailed,
  stateFailedBadge,
  stateIdleBadge,
  stateStarting,
  stateStartingBadge,
  stateStopping,
  stateStoppingBadge,
} from './style.css';

const STATE_LABEL: Record<string, string> = {
  Available: '稼働中',
  Starting: '起動中',
  Stopping: '停止中',
  Rebuilding: '再構築中',
  ShuttingDown: 'シャットダウン中',
  Shutdown: '停止',
  Failed: 'エラー',
  Deleted: '削除済み',
  Unavailable: '利用不可',
};

type Tone = 'available' | 'starting' | 'stopping' | 'failed' | 'idle';

const toneOf = (state: string): Tone => {
  switch (state) {
    case 'Available':
      return 'available';
    case 'Starting':
    case 'Rebuilding':
      return 'starting';
    case 'Stopping':
    case 'ShuttingDown':
      return 'stopping';
    case 'Failed':
    case 'Deleted':
    case 'Unavailable':
      return 'failed';
    default:
      return 'idle';
  }
};

const DOT: Record<Tone, string | undefined> = {
  available: stateAvailable,
  starting: stateStarting,
  stopping: stateStopping,
  failed: stateFailed,
  idle: undefined,
};

const BADGE: Record<Tone, string | undefined> = {
  available: stateAvailableBadge,
  starting: stateStartingBadge,
  stopping: stateStoppingBadge,
  failed: stateFailedBadge,
  idle: stateIdleBadge,
};

const ORDER: Record<Tone, number> = {
  available: 0,
  starting: 1,
  stopping: 1,
  failed: 2,
  idle: 3,
};

const fmt = (bytes: number) => {
  const gb = bytes / 1024 / 1024 / 1024;
  return gb >= 1
    ? `${gb.toFixed(0)}GB`
    : `${(bytes / 1024 / 1024).toFixed(0)}MB`;
};

const minutesSince = (s: string | null) =>
  s ? (Date.now() - new Date(s).getTime()) / 60_000 : 0;

const fmtAgo = (s: string | null) => {
  if (!s) {
    return '—';
  }
  const min = minutesSince(s);
  if (min < 60) {
    return `${Math.floor(min)}分前`;
  }
  if (min < 1440) {
    return `${Math.floor(min / 60)}時間前`;
  }
  return `${Math.floor(min / 1440)}日前`;
};

const fmtUntil = (s: string | null) => {
  if (!s) {
    return null;
  }
  const days = (new Date(s).getTime() - Date.now()) / 86_400_000;
  return days < 1 ? '1日以内' : `${Math.floor(days)}日後`;
};

interface Props {
  codespaces: Codespace[];
  notifyAfterMin: number;
  onStop: (name: string) => Promise<void>;
  billingSummary: BillingUsageSummary | null;
}

const fmtNum = (n: number) =>
  n < 10 ? n.toFixed(1) : Math.round(n).toString();

/** 無料枠の使用量を1本のバーで表す */
const QuotaBar = ({
  label,
  used,
  free,
  unit,
}: {
  label: string;
  used: number;
  free: number;
  unit: string;
}) => {
  // 使った量を表示する（0%から増える）。8割を超えたら赤
  const pct = Math.round((used / free) * 100);
  const level = pct > 80 ? quotaLow : quotaOk;
  return (
    <div className={quotaRow}>
      <div className={quotaHead}>
        <span>{label}</span>
        <span className={quotaValue}>
          使用 {fmtNum(used)} / {free} {unit} ・ <b>{pct}%</b>
        </span>
      </div>
      {/* 数値は上の文字で出しているので、バーは見た目だけ */}
      <div className={quotaTrack} aria-hidden="true">
        <div
          className={clsx(quotaFill, level)}
          style={{ width: `${Math.min(100, pct)}%` }}
        />
      </div>
    </div>
  );
};

const Quota = ({ summary }: { summary: BillingUsageSummary | null }) => {
  const q = codespacesQuota(summary);
  if (!q) {
    return null;
  }
  return (
    <div className={quotaBox}>
      <QuotaBar
        label="無料枠（2コア換算）"
        used={q.usedHours}
        free={q.freeHours}
        unit="時間"
      />
    </div>
  );
};

export const CodespacesPanel = ({
  codespaces,
  notifyAfterMin,
  onStop,
  billingSummary,
}: Props) => {
  const [stopping, setStopping] = useState<string | null>(null);
  const [stopError, setStopError] = useState<string | null>(null);

  const running = codespaces.filter((c) => c.state === 'Available').length;
  const total = codespaces.length;
  const subTitle = `${running} 稼働中 / ${total} 合計`;

  const handleStop = async (cs: Codespace) => {
    if (!confirm(`${cs.display_name || cs.name} を停止しますか？`)) {
      return;
    }
    setStopping(cs.name);
    setStopError(null);
    try {
      await onStop(cs.name);
    } catch (e) {
      setStopError(e instanceof Error ? e.message : String(e));
    } finally {
      setStopping(null);
    }
  };

  if (total === 0) {
    return (
      <BasePanel title="Codespaces" icon="⬡" subTitle={subTitle} badgeText="0">
        <Quota summary={billingSummary} />
        <div className={emptyState}>
          コードスペースはありません 🎉
          <br />
          <small>
            表示されるはずのものがない場合は、GITHUB_TOKEN に
            <code>Codespaces (read)</code> 権限があるか確認してください
          </small>
        </div>
      </BasePanel>
    );
  }

  const sorted = [...codespaces].sort(
    (a, b) =>
      ORDER[toneOf(a.state)] - ORDER[toneOf(b.state)] ||
      new Date(b.last_used_at ?? 0).getTime() -
        new Date(a.last_used_at ?? 0).getTime(),
  );

  return (
    <BasePanel
      title="Codespaces"
      icon="⬡"
      subTitle={subTitle}
      badgeText={`${total}`}
    >
      <Quota summary={billingSummary} />
      {stopError && <p className={csWarn}>⚠️ {stopError}</p>}
      <div className={csList}>
        {sorted.map((cs) => {
          const tone = toneOf(cs.state);
          const forgotten =
            tone === 'available' &&
            minutesSince(cs.last_used_at) >= notifyAfterMin;
          const deleteIn =
            tone === 'available' ? null : fmtUntil(cs.retention_expires_at);

          return (
            <div
              key={cs.id}
              className={clsx(csItem, forgotten && csItemForgotten)}
            >
              <div className={csTop}>
                <span className={clsx(stateDot, DOT[tone])} />
                <span className={csName}>{cs.display_name || cs.name}</span>
                <span className={clsx(stateBadge, BADGE[tone])}>
                  {STATE_LABEL[cs.state] ?? cs.state}
                </span>
              </div>
              <div className={csMeta}>
                <span className={csRepo}>{cs.repository.full_name}</span>
                <span className={csDetail}>
                  {cs.machine ? (
                    <>
                      <span className={csDetailSpan}>
                        {cs.machine.cpus}コア
                      </span>
                      <span className={csDetailSpan}>
                        {fmt(cs.machine.memory_in_bytes)} RAM
                      </span>
                      <span className={csDetailSpan}>
                        {fmt(cs.machine.storage_in_bytes)} ストレージ
                      </span>
                    </>
                  ) : (
                    <span className={csDetailSpan}>マシン情報なし</span>
                  )}
                  <span className={csDetailSpan}>{cs.location}</span>
                </span>
                <span className={csTime}>
                  最終使用: {fmtAgo(cs.last_used_at)}
                  {cs.idle_timeout_minutes
                    ? ` ・ 自動停止 ${cs.idle_timeout_minutes}分`
                    : ''}
                  {deleteIn ? ` ・ 自動削除 ${deleteIn}` : ''}
                </span>
                {forgotten && (
                  <span className={csWarn}>
                    ⏰ {notifyAfterMin}
                    分以上使われていません。つけっぱなしかもしれません
                  </span>
                )}
                {cs.has_unpushed_changes && (
                  <span className={csWarn}>
                    ⚠ 未コミット/未プッシュの変更あり
                  </span>
                )}
              </div>
              <div className={csActions}>
                <a
                  className={csBtn}
                  href={cs.web_url}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  開く
                </a>
                {tone === 'available' && (
                  <button
                    type="button"
                    className={clsx(csBtn, csBtnDanger)}
                    onClick={() => handleStop(cs)}
                    disabled={stopping === cs.name}
                  >
                    {stopping === cs.name ? '停止中…' : '停止'}
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </BasePanel>
  );
};
