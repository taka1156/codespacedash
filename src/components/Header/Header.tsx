import clsx from 'clsx';
import type { GithubUser } from '@/lib/types';
import {
  avatar,
  btnLogout,
  btnRefresh,
  btnRefreshSpinning,
  header,
  headerLeft,
  headerLogo,
  headerRight,
  lastFetchedStyle,
  userInfo,
  username,
} from './style.css';

interface Props {
  user: GithubUser;
  onLogout: () => void;
  onRefresh: () => void;
  loading: boolean;
  lastFetched: Date | null;
}

export const Header = ({
  user,
  onLogout,
  onRefresh,
  loading,
  lastFetched,
}: Props) => (
  <header className={header}>
    <div className={headerLeft}>
      <div className={headerLogo}>
        <img src="./logo.svg" alt="CodespaceDash" />
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
      <div className={userInfo}>
        <img src={user.avatar_url} alt={user.login} className={avatar} />
        <span className={username}>{user.login}</span>
      </div>
      <button type="button" className={btnLogout} onClick={onLogout}>
        ログアウト
      </button>
    </div>
  </header>
);
