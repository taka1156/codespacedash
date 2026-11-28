import { describe, expect, it } from 'vitest';
import { codespacesQuota } from './codespacesQuota';
import type { BillingUsageItem, BillingUsageSummary } from './types';

const item = (p: Partial<BillingUsageItem>): BillingUsageItem => ({
  product: 'codespaces',
  sku: '',
  unitType: '',
  pricePerUnit: 0,
  grossQuantity: 0,
  grossAmount: 0,
  discountQuantity: 0,
  discountAmount: 0,
  netQuantity: 0,
  netAmount: 0,
  ...p,
});

// 2026年11月 = 30日 = 720時間
const NOV = { year: 2026, month: 11 };
const summary = (
  usageItems: BillingUsageItem[],
  timePeriod: BillingUsageSummary['timePeriod'] = NOV,
): BillingUsageSummary => ({ timePeriod, usageItems });

describe('codespacesQuota', () => {
  it('summary がなければ null', () => {
    expect(codespacesQuota(null)).toBeNull();
  });

  describe('ストレージ', () => {
    it('Free は 15 GB-月、Pro は 20 GB-月の枠になる', () => {
      expect(codespacesQuota(summary([]), 'free')?.freeStorageGbMonth).toBe(15);
      expect(codespacesQuota(summary([]), 'pro')?.freeStorageGbMonth).toBe(20);
    });

    it('GB-時間を その月の時間数で割って GB-月にする', () => {
      // 10 GB を 30日（720時間）置いた = 10 GB-月
      const q = codespacesQuota(
        summary([
          item({
            sku: 'codespaces_storage',
            unitType: 'GigabyteHours',
            grossQuantity: 7200,
          }),
        ]),
      );
      expect(q?.usedStorageGbMonth).toBeCloseTo(10);
    });

    it('月の日数の違いを反映する（2月は 28日 = 672時間）', () => {
      const q = codespacesQuota(
        summary(
          [
            item({
              sku: 'codespaces_storage',
              unitType: 'GigabyteHours',
              grossQuantity: 672,
            }),
          ],
          { year: 2027, month: 2 },
        ),
      );
      expect(q?.usedStorageGbMonth).toBeCloseTo(1);
    });

    it.each([
      // うるう年の2月は 29日 = 696時間
      [{ year: 2028, month: 2 }, 696],
      // 31日の月は 744時間
      [{ year: 2026, month: 12 }, 744],
    ])('%o は %s 時間で割る', (timePeriod, hours) => {
      const q = codespacesQuota(
        summary(
          [
            item({
              sku: 'codespaces_storage',
              unitType: 'GigabyteHours',
              grossQuantity: hours,
            }),
          ],
          timePeriod,
        ),
      );
      expect(q?.usedStorageGbMonth).toBeCloseTo(1);
    });

    it('月が分からないときは 1年の平均（730時間）で割る', () => {
      const q = codespacesQuota(
        summary(
          [
            item({
              sku: 'codespaces_storage',
              unitType: 'GigabyteHours',
              grossQuantity: 730,
            }),
          ],
          { year: 2026 },
        ),
      );
      expect(q?.usedStorageGbMonth).toBeCloseTo(1);
    });

    it('プレビルドのストレージも合算する', () => {
      const q = codespacesQuota(
        summary([
          item({
            sku: 'codespaces_storage',
            unitType: 'GigabyteHours',
            grossQuantity: 720,
          }),
          item({
            sku: 'codespaces_prebuild_storage',
            unitType: 'GigabyteHours',
            grossQuantity: 1440,
          }),
        ]),
      );
      expect(q?.usedStorageGbMonth).toBeCloseTo(3);
    });

    it('単位が GB-月ならそのまま使う', () => {
      const q = codespacesQuota(
        summary([
          item({
            sku: 'codespaces_storage',
            unitType: 'GigabyteMonths',
            grossQuantity: 4.2,
          }),
        ]),
      );
      expect(q?.usedStorageGbMonth).toBeCloseTo(4.2);
    });

    it('ストレージはコア時間に混ざらない', () => {
      const q = codespacesQuota(
        summary([
          item({
            sku: 'codespaces_storage',
            unitType: 'GigabyteHours',
            grossQuantity: 7200,
          }),
        ]),
      );
      expect(q?.usedHours).toBe(0);
    });

    it('Codespaces 以外の製品のストレージは数えない', () => {
      const q = codespacesQuota(
        summary([
          item({
            product: 'actions',
            sku: 'actions_cache_storage',
            unitType: 'GigabyteHours',
            grossQuantity: 7200,
          }),
        ]),
      );
      expect(q?.usedStorageGbMonth).toBe(0);
    });
  });

  describe('コア時間', () => {
    it('Free は 2コア換算で 60 時間、Pro は 90 時間の枠になる', () => {
      expect(codespacesQuota(summary([]), 'free')?.freeHours).toBe(60);
      expect(codespacesQuota(summary([]), 'pro')?.freeHours).toBe(90);
    });

    it('codespaces_compute_d4 形式の SKU からコア数を読む', () => {
      // 4コアで 10 時間 = 40 コア時間 = 2コア換算 20 時間
      const q = codespacesQuota(
        summary([
          item({
            sku: 'codespaces_compute_d4',
            unitType: 'hours',
            grossQuantity: 10,
          }),
        ]),
      );
      expect(q?.usedHours).toBe(20);
    });

    it('"8 core" 形式の SKU からもコア数を読む', () => {
      const q = codespacesQuota(
        summary([
          item({
            sku: 'Codespaces compute 8 core',
            unitType: 'hours',
            grossQuantity: 1,
          }),
        ]),
      );
      expect(q?.usedHours).toBe(4);
    });

    it('コア数が読めない SKU は 2コア扱い', () => {
      const q = codespacesQuota(
        summary([
          item({
            sku: 'codespaces_compute',
            unitType: 'hours',
            grossQuantity: 3,
          }),
        ]),
      );
      expect(q?.usedHours).toBe(3);
    });
  });
});
