import type { DashboardResponse, SectionState, TokenInfo } from './types';

/** 期限のこの日数前からダッシュボードに警告を出す */
export const TOKEN_WARN_DAYS = 14;

const DAY_MS = 24 * 60 * 60_000;

export type TokenLevel =
  /** 期限まで余裕がある */
  | 'ok'
  /** 期限が近い（TOKEN_WARN_DAYS 日以内） */
  | 'warn'
  | 'expired'
  /** 期限なしのトークン */
  | 'never'
  | 'unconfigured'
  /** トークン自体が拒否された（無効化・取り消し） */
  | 'invalid'
  | 'error';

export interface TokenStatus {
  level: TokenLevel;
  expiresAt: string | null;
  /** 期限までの日数（切り上げ）。期限がない・取れないときは null */
  daysLeft: number | null;
  /** 取れなかったときの理由 */
  message: string | null;
}

export const tokenStatus = (
  s: SectionState<TokenInfo>,
  now = Date.now(),
): TokenStatus => {
  if (s.status === 'unconfigured') {
    return {
      level: 'unconfigured',
      expiresAt: null,
      daysLeft: null,
      message: `${s.setting} が未設定です`,
    };
  }
  if (s.status !== 'ok') {
    return {
      level: s.status === 'forbidden' ? 'invalid' : 'error',
      expiresAt: null,
      daysLeft: null,
      message: s.message,
    };
  }
  const { expiresAt } = s.data;
  if (expiresAt === null) {
    return { level: 'never', expiresAt, daysLeft: null, message: null };
  }
  const ms = new Date(expiresAt).getTime() - now;
  const daysLeft = Math.ceil(ms / DAY_MS);
  return {
    level: ms <= 0 ? 'expired' : daysLeft <= TOKEN_WARN_DAYS ? 'warn' : 'ok',
    expiresAt,
    daysLeft,
    message: null,
  };
};

export const TOKEN_KEYS = ['github', 'cloudflare'] as const;
export type TokenKey = (typeof TOKEN_KEYS)[number];

export const TOKEN_LABELS: Record<TokenKey, { name: string; env: string }> = {
  github: { name: 'GitHub', env: 'GITHUB_TOKEN' },
  cloudflare: { name: 'Cloudflare', env: 'CLOUDFLARE_API_TOKEN' },
};

/** 期限切れ・期限が近い・無効になったトークン（ダッシュボードの警告に出す） */
export const tokenAlerts = (data: DashboardResponse | null, now?: number) =>
  data
    ? TOKEN_KEYS.map((key) => ({
        key,
        ...tokenStatus(data.tokens[key], now),
      })).filter(
        (t) =>
          t.level === 'warn' || t.level === 'expired' || t.level === 'invalid',
      )
    : [];

export const alertText = (t: { key: TokenKey } & TokenStatus) => {
  const name = `${TOKEN_LABELS[t.key].name} のトークン`;
  return t.level === 'expired'
    ? `${name}の期限が切れています`
    : t.level === 'invalid'
      ? `${name}が無効です`
      : `${name}があと ${t.daysLeft} 日で期限切れになります`;
};
