import clsx from 'clsx';
import { useState } from 'react';
import type { SectionState, WorkflowRun } from '@/lib/types';
import { PanelTabs } from '../shared/PanelTabs/PanelTabs';
import { StatusNote } from '../shared/StatusNote/StatusNote';
import {
  emptyState,
  icon,
  iconFailure,
  iconNeutral,
  iconQueued,
  iconRunning,
  iconSuccess,
  meta,
  metaRepo,
  runItem,
  runList,
  section,
  sectionHead,
  sectionNote,
  time,
  title,
  visibilityTabs,
  workflow,
} from './runHistory.css';

const EVENT_LABEL: Record<string, string> = {
  push: 'push',
  pull_request: 'PR',
  workflow_dispatch: '手動',
  schedule: '定期',
  release: 'release',
  repository_dispatch: 'dispatch',
};

type Kind = 'success' | 'failure' | 'neutral' | 'running' | 'queued';

const kindOf = (r: WorkflowRun): Kind => {
  if (r.status === 'in_progress') {
    return 'running';
  }
  if (r.status !== 'completed') {
    return 'queued';
  }
  switch (r.conclusion) {
    case 'success':
      return 'success';
    case 'failure':
    case 'timed_out':
    case 'startup_failure':
      return 'failure';
    default:
      return 'neutral';
  }
};

const ICON: Record<Kind, { cls: string; char: string; label: string }> = {
  success: { cls: iconSuccess, char: '✓', label: '成功' },
  failure: { cls: iconFailure, char: '✕', label: '失敗' },
  neutral: { cls: iconNeutral, char: '–', label: 'キャンセル/スキップ' },
  running: { cls: iconRunning, char: '', label: '実行中' },
  queued: { cls: iconQueued, char: '•', label: '待機中' },
};

const fmtAgo = (iso: string) => {
  const min = (Date.now() - new Date(iso).getTime()) / 60_000;
  if (min < 1) {
    return 'たった今';
  }
  if (min < 60) {
    return `${Math.floor(min)}分前`;
  }
  if (min < 1440) {
    return `${Math.floor(min / 60)}時間前`;
  }
  return `${Math.floor(min / 1440)}日前`;
};

const fmtDuration = (r: WorkflowRun) => {
  const start = new Date(r.startedAt ?? r.createdAt).getTime();
  const end =
    r.status === 'completed' ? new Date(r.updatedAt).getTime() : Date.now();
  const sec = Math.max(0, Math.round((end - start) / 1000));
  if (sec < 60) {
    return `${sec}秒`;
  }
  const m = Math.floor(sec / 60);
  return m < 60
    ? `${m}分${sec % 60}秒`
    : `${Math.floor(m / 60)}時間${m % 60}分`;
};

interface Props {
  runs: SectionState<WorkflowRun[]>;
}

type Visibility = 'private' | 'public';

const hasFailure = (list: WorkflowRun[]) =>
  list.some((r) => kindOf(r) === 'failure');

/** Actions パネルの下半分：直近の実行履歴（private / public を切り替え） */
export const RunHistory = ({ runs }: Props) => {
  const all = runs.status === 'ok' ? runs.data : [];
  const byVisibility: Record<Visibility, WorkflowRun[]> = {
    private: all.filter((r) => r.private),
    public: all.filter((r) => !r.private),
  };
  const [picked, setPicked] = useState<Visibility | null>(null);
  // 選ぶまでは、いちばん新しい実行がある側を開く
  const current: Visibility =
    picked ?? (all.length > 0 && !all[0].private ? 'public' : 'private');
  const list = byVisibility[current];

  const failed = list.filter((r) => kindOf(r) === 'failure').length;
  const running = list.filter((r) =>
    ['running', 'queued'].includes(kindOf(r)),
  ).length;
  const counts = [
    running ? `${running} 実行中` : null,
    failed ? `${failed} 失敗` : null,
  ]
    .filter(Boolean)
    .join(' / ');

  const tabItem = (key: Visibility, label: string) => ({
    key,
    label: `${label} (${byVisibility[key].length})`,
    // 見ていない側で失敗していれば赤い点
    alert: key !== current && hasFailure(byVisibility[key]),
  });

  return (
    <div className={section}>
      <p className={sectionHead}>
        実行履歴{counts ? ` · ${counts}` : ''}
        <span className={sectionNote}>最近pushした15リポジトリ</span>
      </p>
      {runs.status === 'ok' && (
        <PanelTabs<Visibility>
          label="実行履歴の切り替え"
          className={visibilityTabs}
          current={current}
          onChange={setPicked}
          items={[
            tabItem('private', '🔒 private'),
            tabItem('public', 'public'),
          ]}
        />
      )}
      {runs.status !== 'ok' ? (
        <StatusNote state={runs} what="実行履歴" />
      ) : list.length === 0 ? (
        <div className={emptyState}>最近の実行はありません</div>
      ) : (
        <div className={runList}>
          {list.map((r) => {
            const k = ICON[kindOf(r)];
            return (
              <a
                key={r.id}
                className={runItem}
                href={r.htmlUrl}
                target="_blank"
                rel="noopener noreferrer"
              >
                <span className={clsx(icon, k.cls)} title={k.label}>
                  {k.char}
                </span>
                <span className={title}>
                  {r.title} <span className={workflow}>· {r.workflowName}</span>
                </span>
                <span className={time}>{fmtAgo(r.createdAt)}</span>
                <span className={meta}>
                  <span className={metaRepo}>{r.repo}</span>
                  {r.branch && <span>{r.branch}</span>}
                  <span>{EVENT_LABEL[r.event] ?? r.event}</span>
                  <span>#{r.runNumber}</span>
                  {kindOf(r) !== 'queued' && <span>{fmtDuration(r)}</span>}
                </span>
              </a>
            );
          })}
        </div>
      )}
    </div>
  );
};
