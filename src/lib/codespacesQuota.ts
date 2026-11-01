import type { BillingUsageSummary } from './types';

// GitHub Free の個人アカウントの無料枠（毎月）。2コアのマシンを前提に表示する
export const FREE_CORE_HOURS = 120; // = 2コアで60時間
export const FREE_STORAGE_GB_MONTH = 15;
const BASE_CORES = 2;
const HOURS_PER_MONTH = 730;

export interface QuotaUsage {
  /** 2コア換算の使用時間 */
  usedHours: number;
  freeHours: number;
  usedStorage: number;
  freeStorage: number;
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
  let storage = 0;
  for (const i of items) {
    if (isStorage(i.sku, i.unitType)) {
      // GB-時間で来た場合は GB-月 に直す
      storage += /hour/i.test(i.unitType)
        ? i.grossQuantity / HOURS_PER_MONTH
        : i.grossQuantity;
    } else {
      coreHours += i.grossQuantity * coresOf(i.sku);
    }
  }

  return {
    usedHours: coreHours / BASE_CORES,
    freeHours: FREE_CORE_HOURS / BASE_CORES,
    usedStorage: storage,
    freeStorage: FREE_STORAGE_GB_MONTH,
  };
};
