import clsx from 'clsx';
import {
  TOKEN_KEYS,
  TOKEN_LABELS,
  TOKEN_WARN_DAYS,
  type TokenKey,
  type TokenLevel,
  type TokenStatus,
  tokenStatus,
} from '@/lib/tokens';
import type { DashboardResponse } from '@/lib/types';
import {
  legend,
  pill,
  pillLevel,
  rowHint,
  tokenCard,
  tokenEnv,
  tokenHead,
  tokenKv,
  tokenKvKey,
  tokenLink,
  tokenName,
} from './style.css';

/** トークンを作り直すページ */
const REISSUE_URL: Record<TokenKey, string> = {
  github: 'https://github.com/settings/personal-access-tokens',
  cloudflare: 'https://dash.cloudflare.com/profile/api-tokens',
};

const PILL_TONE: Record<TokenLevel, keyof typeof pillLevel> = {
  ok: 'ok',
  warn: 'warn',
  expired: 'danger',
  invalid: 'danger',
  error: 'danger',
  never: 'muted',
  unconfigured: 'muted',
};

const pillText = (s: TokenStatus) => {
  switch (s.level) {
    case 'ok':
      return '有効';
    case 'warn':
      return `あと ${s.daysLeft} 日`;
    case 'expired':
      return '期限切れ';
    case 'never':
      return '無期限';
    case 'unconfigured':
      return '未設定';
    case 'invalid':
      return '無効';
    default:
      return '取得エラー';
  }
};

export const fmtDateTime = (iso: string) =>
  new Date(iso).toLocaleString('ja-JP', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });

const expiryText = (s: TokenStatus) => {
  if (s.expiresAt === null) {
    return '期限なし';
  }
  const at = fmtDateTime(s.expiresAt);
  return s.level === 'ok' ? `${at}（あと ${s.daysLeft} 日）` : at;
};

const TokenCard = ({ id, status }: { id: TokenKey; status: TokenStatus }) => {
  const { name, env } = TOKEN_LABELS[id];
  const hasExpiry =
    status.level !== 'unconfigured' &&
    status.level !== 'invalid' &&
    status.level !== 'error';
  const needsReissue =
    status.level === 'warn' ||
    status.level === 'expired' ||
    status.level === 'invalid';
  return (
    <section className={tokenCard} aria-label={`${name} のトークン`}>
      <div className={tokenHead}>
        <span className={tokenName}>
          {name} <span className={tokenEnv}>{env}</span>
        </span>
        <span className={clsx(pill, pillLevel[PILL_TONE[status.level]])}>
          {pillText(status)}
        </span>
      </div>
      <dl className={tokenKv}>
        {hasExpiry ? (
          <>
            <dt className={tokenKvKey}>期限</dt>
            <dd>{expiryText(status)}</dd>
          </>
        ) : (
          <>
            <dt className={tokenKvKey}>状態</dt>
            <dd>{status.message}</dd>
          </>
        )}
      </dl>
      {needsReissue && (
        <a
          className={tokenLink}
          href={REISSUE_URL[id]}
          target="_blank"
          rel="noopener noreferrer"
        >
          トークンを再発行 ↗
        </a>
      )}
    </section>
  );
};

/** 設定ページの「トークン」：Worker に置いた API トークンの期限 */
export const TokensSection = ({
  tokens,
}: {
  /** 取得前は null */
  tokens: DashboardResponse['tokens'] | null;
}) => (
  <>
    <p className={legend}>API トークンの期限</p>
    {tokens ? (
      TOKEN_KEYS.map((key) => (
        <TokenCard key={key} id={key} status={tokenStatus(tokens[key])} />
      ))
    ) : (
      <p className={rowHint}>読み込み中…</p>
    )}
    <p className={rowHint}>
      期限の {TOKEN_WARN_DAYS}{' '}
      日前からダッシュボードに警告を出します。再発行したら Worker
      のシークレットを差し替えてください。
    </p>
  </>
);
