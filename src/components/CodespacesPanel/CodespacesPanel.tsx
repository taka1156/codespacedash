import clsx from 'clsx';
import type { Codespace } from '@/lib/types';
import { BasePanel } from '../shared/BasePanel/BasePanel';
import {
  csDetail,
  csDetailSpan,
  csItem,
  csList,
  csMeta,
  csName,
  csRepo,
  csTime,
  csTop,
  emptyState,
  stateAvailableBadge,
  stateBadge,
  stateFailedBadge,
  stateStartingBadge,
  stateStoppingBadge,
} from './style.css';

const STATE_LABEL: Record<string, string> = {
  Available: '稼働中',
  Starting: '起動中',
  Stopping: '停止中',
  Rebuilding: '再構築中',
  ShuttingDown: 'シャットダウン中',
  Failed: 'エラー',
  Deleted: '削除済み',
  Unavailable: '利用不可',
};

const fmt = (bytes: number) => {
  const gb = bytes / 1024 / 1024 / 1024;
  return gb >= 1
    ? `${gb.toFixed(0)}GB`
    : `${(bytes / 1024 / 1024).toFixed(0)}MB`;
};

const fmtDate = (s: string | null) => {
  if (!s) {
    return '—';
  }

  const d = new Date(s);
  const now = Date.now();
  const diff = now - d.getTime();
  const hours = Math.floor(diff / 3600000);

  if (hours < 1) {
    return `${Math.floor(diff / 60000)}分前`;
  }

  if (hours < 24) {
    return `${hours}時間前`;
  }

  return `${Math.floor(hours / 24)}日前`;
};

interface Props {
  codespaces: Codespace[];
}

export const CodespacesPanel = ({ codespaces }: Props) => {
  const running = codespaces.filter((c) => c.state === 'Available').length;
  const total = codespaces.length;

  if (codespaces.length === 0) {
    return (
      <BasePanel
        title="Codespaces"
        icon="⬡"
        subTitle={`${running} 稼働中 / ${total} 合計`}
        badgeText={`${total}`}
      >
        <div className={emptyState}>
          <div className={emptyState}>コードスペースが見つかりません</div>
          <br />
          <small>
            稼働中のコードスペースがないか、データを取得できませんでした
            <br />
            Fine-grained PAT に <code>Codespace</code> 権限が必要です
          </small>
        </div>
      </BasePanel>
    );
  }

  return (
    <BasePanel
      title="Codespaces"
      icon="⬡"
      subTitle={`${running} 稼働中 / ${total} 合計`}
      badgeText={`${total}`}
    >
      <div className={csList}>
        {codespaces.map((cs) => (
          <div key={cs.id} className={csItem}>
            <div className={csTop}>
              <span
                className={clsx('state-dot', {
                  [stateAvailableBadge]: cs.state === 'Available',
                  [stateStartingBadge]:
                    cs.state === 'Starting' || cs.state === 'Rebuilding',
                  [stateStoppingBadge]:
                    cs.state === 'Stopping' || cs.state === 'ShuttingDown',
                  [stateFailedBadge]:
                    cs.state === 'Failed' ||
                    cs.state === 'Deleted' ||
                    cs.state === 'Unavailable',
                })}
              />
              <span className={csName}>{cs.display_name || cs.name}</span>
              <span
                className={clsx(stateBadge, {
                  [stateAvailableBadge]: cs.state === 'Available',
                  [stateStartingBadge]:
                    cs.state === 'Starting' || cs.state === 'Rebuilding',
                  [stateStoppingBadge]:
                    cs.state === 'Stopping' || cs.state === 'ShuttingDown',
                  [stateFailedBadge]:
                    cs.state === 'Failed' ||
                    cs.state === 'Deleted' ||
                    cs.state === 'Unavailable',
                })}
              >
                {STATE_LABEL[cs.state] ?? cs.state}
              </span>
            </div>
            <div className={csMeta}>
              <span className={csRepo}>{cs.repository.full_name}</span>
              <span className={csDetail}>
                {cs.machine ? (
                  <>
                    <span className={csDetailSpan}>{cs.machine.cpus}コア</span>
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
                最終使用: {fmtDate(cs.last_used_at)}
              </span>
            </div>
          </div>
        ))}
      </div>
    </BasePanel>
  );
};
