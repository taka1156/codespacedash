import clsx from 'clsx';
import { routeHref } from '@/hooks/useRoute';
import { asset, IS_STATIC_PREVIEW } from '@/lib/preview';
import type { GithubUser } from '@/lib/types';
import { Icon } from '../shared/Icon/Icon';
import {
  alertDot,
  avatar,
  btnGhost,
  btnRefresh,
  btnRefreshSpinning,
  debugBadge,
  header,
  headerLeft,
  headerLogo,
  headerRight,
  hideOnMobile,
  lastFetchedStyle,
  settingsLink,
  userInfo,
  username,
} from './style.css';

interface Props {
  user: GithubUser | null;
  onRefresh: () => void;
  loading: boolean;
  lastFetched: Date | null;
  /** デバッグモード中（ロゴ横に DEBUG） */
  debug: boolean;
  /** 設定ページで確認してほしいこと（トークンの期限など）があるか */
  settingsAlert: boolean;
}

export const Header = ({
  user,
  onRefresh,
  loading,
  lastFetched,
  debug,
  settingsAlert,
}: Props) => (
  <header className={header}>
    <div className={headerLeft}>
      <div className={headerLogo}>
        <img src={asset('logo.svg')} alt="QuotaDash" />
      </div>
      {debug && (
        <span className={debugBadge} title="デバッグモード：疑似値を表示中">
          DEBUG
        </span>
      )}
    </div>
    <div className={headerRight}>
      {lastFetched && (
        <span className={lastFetchedStyle}>
          {lastFetched.toLocaleTimeString('ja-JP')} 更新
        </span>
      )}
      <button
        type="button"
        className={btnRefresh}
        onClick={onRefresh}
        disabled={loading}
        title="更新"
        aria-label="更新"
      >
        {/* ボタンではなくアイコンだけを回す（SVG の中心が軸） */}
        <Icon name="refresh" className={clsx(loading && btnRefreshSpinning)} />
      </button>
      {/* 通知のオン/オフは設定ページの「通知」に移した */}
      <a
        className={settingsLink}
        href={routeHref({
          page: 'settings',
          section: settingsAlert ? 'tokens' : 'plans',
        })}
        title="設定"
        aria-label={settingsAlert ? '設定（要確認）' : '設定'}
      >
        <Icon name="settings" />
        {settingsAlert && <span className={alertDot} />}
      </a>
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
      {!IS_STATIC_PREVIEW && (
        <a
          className={clsx(btnGhost, hideOnMobile)}
          href="/cdn-cgi/access/logout"
        >
          ログアウト
        </a>
      )}
    </div>
  </header>
);
