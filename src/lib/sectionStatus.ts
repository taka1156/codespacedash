import type { SectionState } from './types';

/** 取れなかった理由を1行で（QuotaBar の右側などに出す） */
export const statusText = (
  s: Exclude<SectionState<unknown>, { status: 'ok' }>,
) => {
  switch (s.status) {
    case 'unconfigured':
      return '未設定';
    case 'forbidden':
      return `権限不足（${s.permission}）`;
    case 'error':
      return '取得失敗';
  }
};
