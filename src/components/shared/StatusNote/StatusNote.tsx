import clsx from 'clsx';
import type { SectionState } from '@/lib/types';
import { OutageHint } from '../ServiceStatus/ServiceStatus';
import { detail, note, noteError, noteForbidden, noteTitle } from './style.css';

type NotOk = Exclude<SectionState<unknown>, { status: 'ok' }>;

/** 取れなかった項目の代わりに出す枠。どのパネルでも同じ見た目にする */
export const StatusNote = ({
  state,
  what,
}: {
  state: NotOk;
  /** 何が取れなかったか（例: 実行履歴） */
  what: string;
}) => {
  switch (state.status) {
    case 'unconfigured':
      return (
        <div className={note}>
          <span className={noteTitle}>{what}は未設定です</span>
          <br />
          <small>
            Worker の変数とシークレットに <code>{state.setting}</code>{' '}
            を追加してください
          </small>
        </div>
      );
    case 'forbidden':
      return (
        <div className={clsx(note, noteForbidden)}>
          <span className={noteTitle}>🔒 {what}を見る権限が足りません</span>
          <br />
          <small>
            トークンに <code>{state.permission}</code> を付けてください
          </small>
          <span className={detail}>{state.message}</span>
        </div>
      );
    case 'error':
      return (
        <div className={clsx(note, noteError)}>
          <span className={noteTitle}>⚠ {what}を取得できませんでした</span>
          <span className={detail}>{state.message}</span>
          <OutageHint />
        </div>
      );
  }
};
