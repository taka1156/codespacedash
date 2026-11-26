import { GITHUB_PLANS, type GithubPlan } from './plans';
import type { BillingUsageSummary } from './types';

const BASE_CORES = 2;

export interface QuotaUsage {
  /** 2コア換算の使用時間 */
  usedHours: number;
  freeHours: number;
  /** ストレージ使用量（GB-月）。停止中の Codespace とプレビルドも含む */
  usedStorageGbMonth: number;
  freeStorageGbMonth: number;
}

// codespaces_storage / codespaces_prebuild_storage（単位は GigabyteHours）
const isStorage = (sku: string, unit: string) =>
  /storage|gb|gigabyte/i.test(`${sku} ${unit}`);

/** SKU 名からコア数を読む（codespaces_compute_d4 / "4 core" 形式。読めなければ2コア扱い） */
const coresOf = (sku: string) => {
  const m = sku.match(/_d(\d+)\b/i) ?? sku.match(/(\d+)\s*-?\s*core/i);
  return m ? Number(m[1]) : BASE_CORES;
};

/** その月の時間数（GB-時間 → GB-月 の換算に使う） */
const hoursInMonth = (period: BillingUsageSummary['timePeriod']) => {
  if (!period.month) {
    return (365 * 24) / 12;
  }
  return new Date(period.year, period.month, 0).getDate() * 24;
};

/**
 * ストレージ量を GB-月 にそろえる。
 * Billing API は GB-時間 で返し、無料枠は GB-月 で決まっている
 * （1 GB を1か月まるごと置くと 1 GB-月）。
 */
const toGbMonth = (
  quantity: number,
  unit: string,
  period: BillingUsageSummary['timePeriod'],
) => (/hour/i.test(unit) ? quantity / hoursInMonth(period) : quantity);

/** summary があれば必ず結果を返す（null を渡したときだけ null） */
export function codespacesQuota(
  summary: BillingUsageSummary,
  plan?: GithubPlan,
): QuotaUsage;
export function codespacesQuota(
  summary: BillingUsageSummary | null,
  plan?: GithubPlan,
): QuotaUsage | null;
export function codespacesQuota(
  summary: BillingUsageSummary | null,
  plan: GithubPlan = 'free',
): QuotaUsage | null {
  const items =
    summary?.usageItems.filter((i) => /codespaces/i.test(i.product)) ?? [];
  if (!summary) {
    return null;
  }

  let coreHours = 0;
  let storageGbMonth = 0;
  for (const i of items) {
    if (isStorage(i.sku, i.unitType)) {
      storageGbMonth += toGbMonth(
        i.grossQuantity,
        i.unitType,
        summary.timePeriod,
      );
    } else {
      coreHours += i.grossQuantity * coresOf(i.sku);
    }
  }

  return {
    usedHours: coreHours / BASE_CORES,
    freeHours: GITHUB_PLANS[plan].codespacesCoreHours / BASE_CORES,
    usedStorageGbMonth: storageGbMonth,
    freeStorageGbMonth: GITHUB_PLANS[plan].codespacesStorageGbMonth,
  };
}
