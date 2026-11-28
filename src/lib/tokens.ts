import { needsAttention, TOKEN_KEYS, tokenStatus } from '../../shared/tokens';
import type { DashboardResponse } from './types';

// 判定の実体は Cron の通知と共有している shared/tokens.ts
export {
  alertText,
  needsAttention,
  TOKEN_KEYS,
  TOKEN_LABELS,
  TOKEN_WARN_DAYS,
  type TokenKey,
  type TokenLevel,
  type TokenStatus,
  tokenStatus,
} from '../../shared/tokens';

/** 期限切れ・期限が近い・無効になったトークン（ダッシュボードの警告に出す） */
export const tokenAlerts = (data: DashboardResponse | null, now?: number) =>
  data
    ? TOKEN_KEYS.map((key) => ({
        key,
        ...tokenStatus(data.tokens[key], now),
      })).filter(needsAttention)
    : [];
