import clsx from 'clsx';
import { type PushStatus, usePush } from '@/hooks/usePush';
import type { DebugSettings, Settings } from '@/hooks/useSettings';
import type { ResolvedPlans } from '@/lib/debug';
import { asset, IS_STATIC_PREVIEW } from '@/lib/preview';
import type { GithubUser } from '@/lib/types';
import { SettingsMenu } from '../SettingsMenu/SettingsMenu';
import {
  avatar,
  btnGhost,
  btnNotifyOn,
  btnRefresh,
  btnRefreshSpinning,
  debugBadge,
  header,
  headerLeft,
  headerLogo,
  headerRight,
  hideOnMobile,
  lastFetchedStyle,
  pushError,
  refreshIcon,
  userInfo,
  username,
} from './style.css';

interface Props {
  user: GithubUser | null;
  onRefresh: () => void;
  loading: boolean;
  lastFetched: Date | null;
  settings: Settings;
  plans: ResolvedPlans;
  onChangeSettings: (patch: Partial<Settings>) => void;
  onChangeDebug: (patch: Partial<DebugSettings>) => void;
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
          🔔<span className={hideOnMobile}> 通知オン</span>
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
          title="この端末の通知を有効にする"
        >
          🔕<span className={hideOnMobile}> 通知を有効化</span>
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
      {status === 'needs-install' ? '📲' : '🔕'}
      <span className={hideOnMobile}> 通知</span>
    </button>
  );
};

export const Header = ({
  user,
  onRefresh,
  loading,
  lastFetched,
  settings,
  plans,
  onChangeSettings,
  onChangeDebug,
}: Props) => (
  <header className={header}>
    <div className={headerLeft}>
      <div className={headerLogo}>
        <img src={asset('logo.svg')} alt="CodespaceDash" />
      </div>
      {settings.debug.enabled && (
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
      >
        {/* ボタンではなくアイコンだけを回す */}
        <span className={clsx(refreshIcon, loading && btnRefreshSpinning)}>
          ↻
        </span>
      </button>
      {!IS_STATIC_PREVIEW && <PushButton />}
      <SettingsMenu
        settings={settings}
        plans={plans}
        onChange={onChangeSettings}
        onChangeDebug={onChangeDebug}
      />
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
