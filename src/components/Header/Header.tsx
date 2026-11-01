import clsx from 'clsx';
import { type PushStatus, usePush } from '@/hooks/usePush';
import type { GithubUser } from '@/lib/types';
import {
  avatar,
  btnGhost,
  btnNotifyOn,
  btnRefresh,
  btnRefreshSpinning,
  header,
  headerLeft,
  headerLogo,
  headerRight,
  hideOnMobile,
  lastFetchedStyle,
  pushError,
  userInfo,
  username,
} from './style.css';

interface Props {
  user: GithubUser | null;
  onRefresh: () => void;
  loading: boolean;
  lastFetched: Date | null;
}

const PUSH_HINT: Partial<Record<PushStatus, string>> = {
  'needs-install':
    'iPhone/iPad では「共有 → ホーム画面に追加」で開いたアプリから通知を有効にできます',
  unsupported: 'このブラウザはプッシュ通知に対応していません',
  disabled: 'サーバー側でプッシュ通知が設定されていません（VAPID鍵）',
  denied: 'ブラウザの設定で通知がブロックされています',
};

const PushButton = () => {
  const { status, busy, error, subscribe, unsubscribe, sendTest } = usePush();

  if (status === 'loading') {
    return null;
  }

  if (status === 'on') {
    return (
      <>
        <button
          type="button"
          className={clsx(btnGhost, hideOnMobile)}
          onClick={sendTest}
          disabled={busy}
        >
          テスト通知
        </button>
        <button
          type="button"
          className={clsx(btnGhost, btnNotifyOn)}
          onClick={unsubscribe}
          disabled={busy}
          title="この端末の通知をオフにする"
        >
          🔔 通知オン
        </button>
        {error && <div className={pushError}>{error}</div>}
      </>
    );
  }

  if (status === 'off') {
    return (
      <>
        <button
          type="button"
          className={btnGhost}
          onClick={subscribe}
          disabled={busy}
        >
          🔕 通知を有効化
        </button>
        {error && <div className={pushError}>{error}</div>}
      </>
    );
  }

  return (
    <button
      type="button"
      className={btnGhost}
      style={{ opacity: 0.6 }}
      title={PUSH_HINT[status]}
      onClick={() => alert(PUSH_HINT[status])}
    >
      {status === 'needs-install' ? '📲 通知' : '🔕 通知'}
    </button>
  );
};

export const Header = ({ user, onRefresh, loading, lastFetched }: Props) => (
  <header className={header}>
    <div className={headerLeft}>
      <div className={headerLogo}>
        <img src="/logo.svg" alt="CodespaceDash" />
      </div>
    </div>
    <div className={headerRight}>
      {lastFetched && (
        <span className={lastFetchedStyle}>
          {lastFetched.toLocaleTimeString('ja-JP')} 更新
        </span>
      )}
      <button
        type="button"
        className={clsx(btnRefresh, loading && btnRefreshSpinning)}
        onClick={onRefresh}
        disabled={loading}
        title="更新"
      >
        ↻
      </button>
      <PushButton />
      {user && (
        <a
          className={userInfo}
          href={user.html_url}
          target="_blank"
          rel="noopener noreferrer"
        >
          <img src={user.avatar_url} alt={user.login} className={avatar} />
          <span className={username}>{user.login}</span>
        </a>
      )}
      {/* Cloudflare Access のログアウト */}
      <a className={clsx(btnGhost, hideOnMobile)} href="/cdn-cgi/access/logout">
        ログアウト
      </a>
    </div>
  </header>
);
