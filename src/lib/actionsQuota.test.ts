import { describe, expect, it } from 'vitest';
import { actionsQuota } from './actionsQuota';
import type { BillingUsageItem, BillingUsageSummary } from './types';

const item = (p: Partial<BillingUsageItem>): BillingUsageItem => ({
  product: 'actions',
  sku: 'actions_linux',
  unitType: 'minutes',
  pricePerUnit: 0.006,
  grossQuantity: 0,
  grossAmount: 0,
  discountQuantity: 0,
  discountAmount: 0,
  netQuantity: 0,
  netAmount: 0,
  ...p,
});

const summary = (usageItems: BillingUsageItem[]): BillingUsageSummary => ({
  timePeriod: { year: 2026, month: 11 },
  usageItems,
});

describe('actionsQuota', () => {
  it('summary がなければ null', () => {
    expect(actionsQuota(null)).toBeNull();
  });

  it('Free は 2000 分、Pro は 3000 分の枠になる', () => {
    expect(actionsQuota(summary([]), 'free')?.freeMinutes).toBe(2000);
    expect(actionsQuota(summary([]), 'pro')?.freeMinutes).toBe(3000);
  });

  it('プラン省略時は Free', () => {
    expect(actionsQuota(summary([]))?.freeMinutes).toBe(2000);
  });

  it('金額を Linux の単価で割って分数にする', () => {
    // Linux 100分 ($0.6) + macOS 10分 ($0.62 = Linux 換算 約103分)
    const q = actionsQuota(
      summary([
        item({ grossAmount: 0.6 }),
        item({ sku: 'actions_macos', grossAmount: 0.62 }),
      ]),
    );
    expect(q?.usedMinutes).toBeCloseTo(100 + 0.62 / 0.006);
  });

  it('Actions の minutes 以外（ストレージ・他製品）は数えない', () => {
    const q = actionsQuota(
      summary([
        item({ grossAmount: 0.06 }),
        item({ unitType: 'GigabyteHours', grossAmount: 5 }),
        item({ product: 'codespaces', grossAmount: 5 }),
      ]),
    );
    expect(q?.usedMinutes).toBeCloseTo(10);
  });

  it('product の大文字小文字は区別しない', () => {
    expect(
      actionsQuota(summary([item({ product: 'Actions', grossAmount: 0.06 })]))
        ?.usedMinutes,
    ).toBeCloseTo(10);
  });
});
