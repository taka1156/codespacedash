import { GITHUB_PLANS, type GithubPlan } from './plans';
import type { BillingUsageSummary } from './types';

const LINUX_USD_PER_MIN = 0.006;

export interface ActionsQuota {
  /** Linux 換算の使用分数 */
  usedMinutes: number;
  freeMinutes: number;
}

/** summary があれば必ず結果を返す（null を渡したときだけ null） */
export function actionsQuota(
  summary: BillingUsageSummary,
  plan?: GithubPlan,
): ActionsQuota;
export function actionsQuota(
  summary: BillingUsageSummary | null,
  plan?: GithubPlan,
): ActionsQuota | null;
export function actionsQuota(
  summary: BillingUsageSummary | null,
  plan: GithubPlan = 'free',
): ActionsQuota | null {
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
    freeMinutes: GITHUB_PLANS[plan].actionsMinutes,
  };
}
