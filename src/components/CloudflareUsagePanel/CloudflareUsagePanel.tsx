import { usageErrorDetails } from '@/lib/cloudflareUsage';
import { statusText } from '@/lib/sectionStatus';
import type { SectionState } from '@/lib/types';
import { BasePanel } from '../shared/BasePanel/BasePanel';
import { QuotaBar } from '../shared/QuotaBar/QuotaBar';
import { errorList, footNote, list } from './style.css';

export interface UsageItem {
  key: string;
  label: string;
  free: number;
  unit: string;
}

interface Props {
  title: string;
  icon: string;
  subTitle: string;
  items: readonly UsageItem[];
  /** 項目ごとの使用量。まだ取得していない項目は undefined */
  values?: Partial<Record<string, SectionState<number>>>;
  note?: React.ReactNode;
}

/** 取れなかった項目のエラー文。本番でしか確かめられないので、画面で原因を読めるようにする */
const ErrorDetails = ({ items, values }: Pick<Props, 'items' | 'values'>) => {
  const d = usageErrorDetails(items, values);
  if (!d) {
    return null;
  }
  return (
    <ul className={errorList}>
      {d.permissions.map((p) => (
        <li key={p}>
          🔒 トークンに <code>{p}</code> を付けてください
        </li>
      ))}
      {d.lines.map((l) => (
        <li key={l.key}>{l.label ? `${l.label}: ${l.text}` : l.text}</li>
      ))}
    </ul>
  );
};

/** Cloudflare の無料枠を項目ごとのバーで並べる。取れない項目もバーの位置は残す */
export const CloudflareUsagePanel = ({
  title,
  icon,
  subTitle,
  items,
  values,
  note,
}: Props) => (
  <BasePanel title={title} icon={icon} subTitle={subTitle}>
    <div className={list}>
      {items.map((item) => {
        const v = values?.[item.key];
        return v?.status === 'ok' ? (
          <QuotaBar
            key={item.key}
            label={item.label}
            used={v.data}
            free={item.free}
            unit={item.unit}
          />
        ) : (
          <QuotaBar
            key={item.key}
            label={item.label}
            free={item.free}
            unit={item.unit}
            unavailable={
              !v
                ? '未対応'
                : v.status === 'forbidden'
                  ? '権限不足'
                  : statusText(v)
            }
          />
        );
      })}
    </div>
    <ErrorDetails items={items} values={values} />
    {note && <p className={footNote}>{note}</p>}
  </BasePanel>
);
