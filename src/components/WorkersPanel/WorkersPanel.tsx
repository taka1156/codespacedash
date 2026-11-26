import clsx from 'clsx';
import { WORKERS_PLANS, type WorkersPlan } from '@/lib/plans';
import { statusText } from '@/lib/sectionStatus';
import type {
  SectionState,
  WorkerBuild,
  WorkersBuildsSummary,
} from '@/lib/types';
import { type BuildKind, buildKind } from '@/lib/workerBuildKind';
import {
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
  workflow,
} from '../ActionsPanel/runHistory.css';
import { BasePanel } from '../shared/BasePanel/BasePanel';
import { QuotaBar } from '../shared/QuotaBar/QuotaBar';
import { StatusNote } from '../shared/StatusNote/StatusNote';
import { emptyState, hash, quotaNote, quotaWrap, warn } from './style.css';

const ICON: Record<BuildKind, { cls: string; char: string; label: string }> = {
  success: { cls: iconSuccess, char: '✓', label: '成功' },
  failure: { cls: iconFailure, char: '✕', label: '失敗' },
  neutral: { cls: iconNeutral, char: '–', label: 'キャンセル/スキップ' },
  running: { cls: iconRunning, char: '', label: 'ビルド中' },
  queued: { cls: iconQueued, char: '•', label: '待機中' },
};

const SOURCE_LABEL: Record<string, string> = {
  push: 'push',
  pull_request: 'PR',
  manual: '手動',
  api: 'API',
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

const fmtDuration = (b: WorkerBuild) => {
  const start = new Date(b.startedAt ?? b.createdAt).getTime();
  const end = b.stoppedAt ? new Date(b.stoppedAt).getTime() : Date.now();
  const sec = Math.max(0, Math.round((end - start) / 1000));
  return sec < 60 ? `${sec}秒` : `${Math.floor(sec / 60)}分${sec % 60}秒`;
};

const fmtDate = (iso: string) =>
  new Date(iso).toLocaleDateString('ja-JP', {
    month: 'numeric',
    day: 'numeric',
  });

interface Props {
  builds: SectionState<WorkersBuildsSummary>;
  plan: WorkersPlan;
}

export const WorkersPanel = ({ builds: state, plan }: Props) => {
  const summary = state.status === 'ok' ? state.data : null;
  const limit = WORKERS_PLANS[plan].buildMinutes;
  const builds = summary?.builds ?? [];
  const failed = builds.filter((b) => buildKind(b) === 'failure').length;
  const running = builds.filter((b) =>
    ['running', 'queued'].includes(buildKind(b)),
  ).length;
  const counts = [
    running ? `${running} ビルド中` : null,
    failed ? `${failed} 失敗` : null,
  ]
    .filter(Boolean)
    .join(' / ');

  // 今期の終わり（end）は次の期間の始まりなので、表示は前日にする
  const periodLabel = summary
    ? `${fmtDate(summary.period.start)}〜${fmtDate(
        new Date(new Date(summary.period.end).getTime() - 1).toISOString(),
      )}`
    : undefined;

  return (
    <BasePanel
      title="Workers Builds"
      icon={'☁\uFE0E'}
      subTitle={
        summary
          ? `${periodLabel} のビルド時間 · ${summary.workerCount} Worker`
          : undefined
      }
      badgeText={
        summary ? `${summary.usedMinutes.toLocaleString()} 分` : undefined
      }
    >
      {state.status !== 'ok' ? (
        <>
          <div className={quotaWrap}>
            <QuotaBar
              label={`${WORKERS_PLANS[plan].label} のビルド時間`}
              free={limit}
              unit="分"
              unavailable={statusText(state)}
            />
          </div>
          <div className={section}>
            <StatusNote state={state} what="Workers Builds" />
          </div>
        </>
      ) : !summary ? null : (
        <>
          <div className={quotaWrap}>
            <QuotaBar
              label={`${WORKERS_PLANS[plan].label} のビルド時間`}
              used={summary.usedMinutes}
              free={limit}
              unit="分"
            />
            <span className={quotaNote}>
              使用量 API
              がないため、各ビルドの所要時間（1分単位で切り上げ）から推定
            </span>
            {(summary.limitReached ||
              (plan === 'free' && summary.usedMinutes >= limit)) && (
              <span className={warn}>
                ⚠ ビルド時間の上限に達しています。{fmtDate(summary.period.end)}
                にリセットされるまでビルドできません
              </span>
            )}
          </div>

          <div className={section}>
            <p className={sectionHead}>
              ビルド履歴{counts ? ` · ${counts}` : ''}
              <span className={sectionNote}>Git 連携している Worker</span>
            </p>
            {builds.length === 0 ? (
              <div className={emptyState}>最近のビルドはありません</div>
            ) : (
              <div className={runList}>
                {builds.map((b) => {
                  const k = ICON[buildKind(b)];
                  return (
                    <a
                      key={b.id}
                      className={runItem}
                      href={b.dashboardUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <span className={clsx(icon, k.cls)} title={k.label}>
                        {k.char}
                      </span>
                      <span className={title}>
                        {b.commitMessage?.split('\n')[0] || '(メッセージなし)'}{' '}
                        <span className={workflow}>· {b.worker}</span>
                      </span>
                      <span className={time}>{fmtAgo(b.createdAt)}</span>
                      <span className={meta}>
                        {b.repo && <span className={metaRepo}>{b.repo}</span>}
                        {b.branch && <span>{b.branch}</span>}
                        {b.source && (
                          <span>{SOURCE_LABEL[b.source] ?? b.source}</span>
                        )}
                        {b.commitHash && (
                          <span className={hash}>
                            {b.commitHash.slice(0, 7)}
                          </span>
                        )}
                        {buildKind(b) !== 'queued' && (
                          <span>{fmtDuration(b)}</span>
                        )}
                      </span>
                    </a>
                  );
                })}
              </div>
            )}
          </div>
        </>
      )}
    </BasePanel>
  );
};
