import { statusText } from '@/lib/sectionStatus';
import type { SectionState } from '@/lib/types';
import { BasePanel } from '../shared/BasePanel/BasePanel';
import { QuotaBar } from '../shared/QuotaBar/QuotaBar';
import { footNote, list } from './style.css';

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
            unavailable={v ? statusText(v) : '未対応'}
          />
        );
      })}
    </div>
    {note && <p className={footNote}>{note}</p>}
  </BasePanel>
);
