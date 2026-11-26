import {
  CLOUDFLARE_DAILY_KEYS,
  CLOUDFLARE_MONTHLY_KEYS,
} from '../../shared/types';
import type { CloudflareUsage, SectionState } from './types';

type Which = 'daily' | 'monthly';

/**
 * パネルに渡す項目ごとの状態。
 * 使用量全体が取れなかったとき（未設定・権限不足など）は、全項目を同じ状態にする
 */
export const usageValues = (
  usage: SectionState<CloudflareUsage> | undefined,
  which: Which,
): Record<string, SectionState<number>> | undefined => {
  if (!usage) {
    return undefined;
  }
  if (usage.status === 'ok') {
    return usage.data[which];
  }
  const keys =
    which === 'daily' ? CLOUDFLARE_DAILY_KEYS : CLOUDFLARE_MONTHLY_KEYS;
  return Object.fromEntries(keys.map((k) => [k, usage]));
};

export interface UsageErrorDetails {
  /** 付けるべき権限名（重複なし） */
  permissions: string[];
  /** 項目ごとのエラー文。全項目が同じ理由なら label なしの1行にまとめる */
  lines: { key: string; label: string | null; text: string }[];
}

/** 取れなかった項目のエラー文をまとめる。本番でしか確かめられないので、画面で原因を読めるようにする */
export const usageErrorDetails = (
  items: readonly { key: string; label: string }[],
  values: Partial<Record<string, SectionState<number>>> | undefined,
): UsageErrorDetails | null => {
  const failed = items.flatMap((item) => {
    const v = values?.[item.key];
    return v?.status === 'forbidden' || v?.status === 'error'
      ? [{ item, v }]
      : [];
  });
  if (failed.length === 0) {
    return null;
  }
  const permissions = [
    ...new Set(
      failed.flatMap(({ v }) => (v.status === 'forbidden' ? v.permission : [])),
    ),
  ];
  const texts = new Set(failed.map(({ v }) => v.message));
  const lines =
    failed.length > 1 && texts.size === 1
      ? [{ key: 'all', label: null, text: failed[0].v.message }]
      : failed.map(({ item, v }) => ({
          key: item.key,
          label: item.label,
          text: v.message,
        }));
  return { permissions, lines };
};
