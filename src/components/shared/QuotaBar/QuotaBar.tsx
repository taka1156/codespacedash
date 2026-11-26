import clsx from 'clsx';
import { fmtNum } from '@/lib/format';
import {
  quotaFill,
  quotaHead,
  quotaLow,
  quotaOk,
  quotaRow,
  quotaTrack,
  quotaTrackEmpty,
  quotaUnavailable,
  quotaValue,
} from './style.css';

type Props = {
  label: string;
  free: number;
  unit: string;
} & (
  | { used: number; unavailable?: undefined }
  /** 取れなかったときの理由。バーは空のまま、同じ高さで出す */
  | { used?: undefined; unavailable: React.ReactNode }
);

/** 無料枠の使用量を1本のバーで表す */
export const QuotaBar = ({ label, used, free, unit, unavailable }: Props) => {
  if (used === undefined) {
    return (
      <div className={quotaRow}>
        <div className={quotaHead}>
          <span>{label}</span>
          <span className={clsx(quotaValue, quotaUnavailable)}>
            {unavailable} ・ 枠 {free.toLocaleString()} {unit}
          </span>
        </div>
        <div className={clsx(quotaTrack, quotaTrackEmpty)} aria-hidden="true" />
      </div>
    );
  }
  // 使った量を表示する（0%から増える）。8割を超えたら赤
  const pct = Math.round((used / free) * 100);
  const level = pct > 80 ? quotaLow : quotaOk;
  return (
    <div className={quotaRow}>
      <div className={quotaHead}>
        <span>{label}</span>
        <span className={quotaValue}>
          使用 {fmtNum(used)} / {free.toLocaleString()} {unit} ・ <b>{pct}%</b>
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
