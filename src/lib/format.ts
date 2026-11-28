/** 値が読めないとき（NaN など）に代わりに出す文字 */
export const UNKNOWN = '—';

/** 使用量の数値。小さい値は小数で、大きい値は桁区切りで出す */
export const fmtNum = (n: number) =>
  !Number.isFinite(n)
    ? UNKNOWN
    : n === 0
      ? '0'
      : n < 1
        ? n.toFixed(2)
        : n < 10
          ? n.toFixed(1)
          : Math.round(n).toLocaleString('en-US');

/** 何分前・何時間前・何日前 */
export const fmtAgo = (iso: string) => {
  const min = (Date.now() - new Date(iso).getTime()) / 60_000;
  if (Number.isNaN(min)) {
    return UNKNOWN;
  }
  if (min < 1) {
    return 'たった今';
  }
  if (min < 60) {
    return `${Math.floor(min)}分前`;
  }
  if (min < 1440) {
    return `${Math.floor(min / 60)}時間前`;
  }
  return `${Math.floor(min / 1440)}日前`;
};
