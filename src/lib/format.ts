/** 使用量の数値。小さい値は小数で、大きい値は桁区切りで出す */
export const fmtNum = (n: number) =>
  n === 0
    ? '0'
    : n < 1
      ? n.toFixed(2)
      : n < 10
        ? n.toFixed(1)
        : Math.round(n).toLocaleString('en-US');
