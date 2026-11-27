import clsx from 'clsx';
import { useId, useState } from 'react';
import { fmtAgo } from '@/lib/format';
import { totalPulls } from '@/lib/pulls';
import type {
  PullRequest,
  PullReview,
  RepoPulls,
  SectionState,
} from '@/lib/types';
import { StatusNote } from '../shared/StatusNote/StatusNote';
import {
  body,
  chevron,
  chevronOpen,
  count,
  countActive,
  emptyState,
  external,
  head,
  headActions,
  icon,
  iconDraft,
  iconOpen,
  meta,
  metaStrong,
  more,
  panel,
  pullItem,
  pullTitle,
  repo as repoCls,
  repoHead,
  repoList,
  repoName,
  repoNote,
  reviewApproved,
  reviewChanges,
  review as reviewCls,
  reviewRequired,
  skeleton,
  smallBtn,
  staleNote,
  sub,
  time,
  title,
  toggle,
} from './style.css';

interface Props {
  /** 登録した順のお気に入り（owner/repo） */
  favorites: string[];
  /** まだ取れていなければ null */
  pulls: SectionState<RepoPulls[]> | null;
  /** 通信そのものの失敗 */
  error: string | null;
}

const REVIEW: Record<PullReview, { label: string; cls: string }> = {
  approved: { label: '承認済み', cls: reviewApproved },
  changes_requested: { label: '変更依頼', cls: reviewChanges },
  review_required: { label: 'レビュー待ち', cls: reviewRequired },
};

const keyOf = (repo: string) => repo.toLowerCase();

const PullRow = ({ p }: { p: PullRequest }) => {
  const r = p.review ? REVIEW[p.review] : null;
  return (
    <a
      className={pullItem}
      href={p.url}
      target="_blank"
      rel="noopener noreferrer"
    >
      <span
        className={clsx(icon, p.draft ? iconDraft : iconOpen)}
        title={p.draft ? 'Draft' : 'Open'}
      >
        {p.draft ? '◌' : '⇄'}
      </span>
      <span className={pullTitle}>{p.title}</span>
      <span className={time} title={`更新: ${p.updatedAt}`}>
        {fmtAgo(p.updatedAt)}
      </span>
      <span className={meta}>
        <span className={metaStrong}>#{p.number}</span>
        {p.draft && <span>Draft</span>}
        {p.author && <span>{p.author}</span>}
        <span>{p.branch}</span>
        {r && <span className={clsx(reviewCls, r.cls)}>{r.label}</span>}
        {p.comments > 0 && <span title="コメント">💬 {p.comments}</span>}
      </span>
    </a>
  );
};

const RepoAccordion = ({
  name,
  data,
  open,
  onToggle,
}: {
  name: string;
  /** まだ取れていない（登録した直後など）なら undefined */
  data: RepoPulls | undefined;
  open: boolean;
  onToggle: () => void;
}) => {
  const id = useId();
  const n = data?.totalCount ?? 0;
  return (
    <div className={repoCls}>
      <h3 className={repoHead}>
        <button
          type="button"
          className={toggle}
          id={`${id}-head`}
          aria-expanded={open}
          aria-controls={`${id}-body`}
          onClick={onToggle}
        >
          <span className={clsx(chevron, open && chevronOpen)} aria-hidden>
            ▸
          </span>
          <span className={repoName}>
            {data?.private && <span title="private">🔒 </span>}
            {name}
          </span>
          {data && !data.found && (
            <span className={repoNote}>見つかりません</span>
          )}
          <span
            className={clsx(count, n > 0 && countActive)}
            title="オープンな PR"
          >
            {data ? n : '…'}
          </span>
        </button>
        <a
          className={external}
          href={`${data?.url ?? `https://github.com/${name}`}/pulls`}
          target="_blank"
          rel="noopener noreferrer"
          title="GitHub で PR 一覧を開く"
          aria-label={`${name} の PR 一覧を GitHub で開く`}
        >
          ↗
        </a>
      </h3>
      {open && (
        <section
          className={body}
          id={`${id}-body`}
          aria-labelledby={`${id}-head`}
        >
          {!data ? (
            <div className={emptyState}>読み込み中…</div>
          ) : !data.found ? (
            <div className={emptyState}>
              リポジトリが見つかりません。名前が正しいか、トークンで見られるリポジトリか確認してください
            </div>
          ) : data.pulls.length === 0 ? (
            <div className={emptyState}>オープンな PR はありません</div>
          ) : (
            <>
              {data.pulls.map((p) => (
                <PullRow key={p.number} p={p} />
              ))}
              {data.totalCount > data.pulls.length && (
                <a
                  className={more}
                  href={`${data.url}/pulls`}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  ほか {data.totalCount - data.pulls.length} 件を GitHub で見る
                  ↗
                </a>
              )}
            </>
          )}
        </section>
      )}
    </div>
  );
};

/** PR タブ：お気に入りリポジトリごとのオープンな PR をアコーディオンで出す */
export const PullsPanel = ({ favorites, pulls, error }: Props) => {
  // 開閉を一度でも変えたリポジトリだけ覚える。触っていなければ PR があるものを開く
  const [openMap, setOpenMap] = useState<Record<string, boolean>>({});

  const byRepo = new Map(
    pulls?.status === 'ok' ? pulls.data.map((r) => [keyOf(r.repo), r]) : [],
  );
  const isOpen = (name: string) =>
    openMap[keyOf(name)] ?? (byRepo.get(keyOf(name))?.pulls.length ?? 0) > 0;
  const setAll = (open: boolean) =>
    setOpenMap(Object.fromEntries(favorites.map((f) => [keyOf(f), open])));

  const total = totalPulls(pulls);

  return (
    <section className={panel} aria-label="お気に入りリポジトリの PR">
      <div className={head}>
        <div>
          <h2 className={title}>⇄ オープンな PR</h2>
          <p className={sub}>
            お気に入り {favorites.length} リポジトリ
            {total !== null && ` · 合計 ${total} 件`}
          </p>
        </div>
        {favorites.length > 0 && pulls?.status === 'ok' && (
          <div className={headActions}>
            <button
              type="button"
              className={smallBtn}
              onClick={() => setAll(true)}
            >
              すべて開く
            </button>
            <button
              type="button"
              className={smallBtn}
              onClick={() => setAll(false)}
            >
              すべて閉じる
            </button>
          </div>
        )}
      </div>

      {error && pulls && (
        <p className={staleNote} role="status">
          ⚠ 更新できませんでした（前回の結果を表示しています）: {error}
        </p>
      )}
      {favorites.length === 0 ? (
        <div className={emptyState}>
          お気に入りのリポジトリがありません。
          <br />
          右上の設定（歯車）→「お気に入り」で登録すると、ここにオープンな PR
          が出ます
        </div>
      ) : error && !pulls ? (
        <StatusNote state={{ status: 'error', message: error }} what="PR" />
      ) : !pulls ? (
        <div className={repoList} aria-busy="true">
          {favorites.map((f) => (
            <div key={f} className={skeleton} />
          ))}
        </div>
      ) : pulls.status !== 'ok' ? (
        <StatusNote state={pulls} what="PR" />
      ) : (
        <div className={repoList}>
          {favorites.map((f) => (
            <RepoAccordion
              key={keyOf(f)}
              name={f}
              data={byRepo.get(keyOf(f))}
              open={isOpen(f)}
              onToggle={() =>
                setOpenMap((m) => ({ ...m, [keyOf(f)]: !isOpen(f) }))
              }
            />
          ))}
        </div>
      )}
    </section>
  );
};
