import clsx from 'clsx';
import {
  quotaFill,
  quotaHead,
  quotaLow,
  quotaOk,
  quotaRow,
  quotaTrack,
  quotaValue,
} from './style.css';

const fmtNum = (n: number) =>
  n < 10 ? n.toFixed(1) : Math.round(n).toString();

/** 無料枠の使用量を1本のバーで表す */
export const QuotaBar = ({
  label,
  used,
  free,
  unit,
}: {
  label: string;
  used: number;
  free: number;
  unit: string;
}) => {
  // 使った量を表示する（0%から増える）。8割を超えたら赤
  const pct = Math.round((used / free) * 100);
  const level = pct > 80 ? quotaLow : quotaOk;
  return (
    <div className={quotaRow}>
      <div className={quotaHead}>
        <span>{label}</span>
        <span className={quotaValue}>
          使用 {fmtNum(used)} / {free} {unit} ・ <b>{pct}%</b>
        </span>
      </div>
      {/* 数値は上の文字で出しているので、バーは見た目だけ */}
      <div className={quotaTrack} aria-hidden="true">
        <div
          className={clsx(quotaFill, level)}
          style={{ width: `${Math.min(100, pct)}%` }}
        />
      </div>
    </div>
  );
};
