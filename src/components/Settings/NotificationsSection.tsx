import { type PushStatus, usePush } from '@/hooks/usePush';
import { Icon } from '../shared/Icon/Icon';
import {
  actions,
  legend,
  pushError,
  pushState,
  rowHint,
  smallBtn,
} from './style.css';

const PUSH_HINT: Record<
  Exclude<PushStatus, 'loading' | 'on' | 'off'>,
  string
> = {
  'needs-install':
    'iPhone/iPad では「共有 → ホーム画面に追加」で開いたアプリから通知を有効にできます',
  unsupported: 'このブラウザはプッシュ通知に対応していません',
  disabled: 'サーバー側でプッシュ通知が設定されていません（VAPID鍵）',
  denied: 'ブラウザの設定で通知がブロックされています',
};

/** 設定ページの「通知」：この端末でプッシュ通知を受け取るか */
export const NotificationsSection = () => {
  const { status, busy, error, subscribe, unsubscribe, sendTest } = usePush();

  return (
    <>
      <p className={legend}>この端末のプッシュ通知</p>
      <p className={rowHint}>
        Codespaces の消し忘れを通知します。通知の設定は端末ごとです。
      </p>
      {status === 'loading' ? (
        <p className={rowHint}>確認中…</p>
      ) : status === 'on' ? (
        <>
          <p className={pushState}>
            <Icon name="bell" /> 通知オン
          </p>
          <div className={actions}>
            <button
              type="button"
              className={smallBtn}
              onClick={sendTest}
              disabled={busy}
            >
              テスト通知
            </button>
            <button
              type="button"
              className={smallBtn}
              onClick={unsubscribe}
              disabled={busy}
            >
              通知をオフにする
            </button>
          </div>
        </>
      ) : status === 'off' ? (
        <>
          <p className={pushState}>
            <Icon name="bellOff" /> 通知オフ
          </p>
          <div className={actions}>
            <button
              type="button"
              className={smallBtn}
              onClick={subscribe}
              disabled={busy}
            >
              通知を有効化
            </button>
          </div>
        </>
      ) : (
        <p className={pushState}>
          <Icon name={status === 'needs-install' ? 'smartphone' : 'bellOff'} />{' '}
          {PUSH_HINT[status]}
        </p>
      )}
      {error && <p className={pushError}>{error}</p>}
    </>
  );
};
