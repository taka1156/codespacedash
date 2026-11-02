import type { BillingUsageSummary } from './types';

// GitHub Free の個人アカウントの無料枠（毎月）。2コアのマシンを前提に表示する
export const FREE_CORE_HOURS = 120; // = 2コアで60時間
const BASE_CORES = 2;

export interface QuotaUsage {
  /** 2コア換算の使用時間 */
  usedHours: number;
  freeHours: number;
}

const isStorage = (sku: string, unit: string) =>
  /storage|gb|gigabyte/i.test(`${sku} ${unit}`);

/** SKU 名からコア数を読む（読めなければ2コア扱い） */
const coresOf = (sku: string) => {
  const m = sku.match(/(\d+)\s*-?\s*core/i);
  return m ? Number(m[1]) : BASE_CORES;
};

export const codespacesQuota = (
  summary: BillingUsageSummary | null,
): QuotaUsage | null => {
  const items =
    summary?.usageItems.filter((i) => /codespaces/i.test(i.product)) ?? [];
  if (!summary) {
    return null;
  }

  let coreHours = 0;
  for (const i of items) {
    // ストレージは対象外（コンピューティング時間だけ数える）
    if (!isStorage(i.sku, i.unitType)) {
      coreHours += i.grossQuantity * coresOf(i.sku);
    }
  }

  return {
    usedHours: coreHours / BASE_CORES,
    freeHours: FREE_CORE_HOURS / BASE_CORES,
  };
};
