import type { BillingUsageSummary } from './types';

// GitHub Free の個人アカウントの Actions 無料枠は「毎月 12 ドル分」（分数ではなく金額）。
// 分かりやすさのため、Linux 2コアの単価で分に直して表示する（12ドル ≒ 2,000分）
const FREE_USD = 12;
const LINUX_USD_PER_MIN = 0.006;

export interface ActionsQuota {
  /** Linux 換算の使用分数 */
  usedMinutes: number;
  freeMinutes: number;
}

export const actionsQuota = (
  summary: BillingUsageSummary | null,
): ActionsQuota | null => {
  if (!summary) {
    return null;
  }
  // 実行時間（minutes）の金額だけを合計。公開リポジトリの実行は無料なので含まれない
  const usedUsd = summary.usageItems
    .filter(
      (i) => i.product.toLowerCase() === 'actions' && i.unitType === 'minutes',
    )
    .reduce((sum, i) => sum + i.grossAmount, 0);

  return {
    usedMinutes: usedUsd / LINUX_USD_PER_MIN,
    freeMinutes: FREE_USD / LINUX_USD_PER_MIN,
  };
};
