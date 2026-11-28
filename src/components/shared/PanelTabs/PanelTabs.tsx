import clsx from 'clsx';
import { type KeyboardEvent, useId } from 'react';
import { dot, outageMark, tab, tabs } from './style.css';

export interface PanelTab<K extends string> {
  key: K;
  label: string;
  /** 失敗があるときなどに赤い点を出す */
  alert?: boolean;
  /** 公式ステータスページで障害が出ているときに ⚠ を出す */
  outage?: boolean;
}

/** 表示を切り替えるタブ（左右キーでも移動できる） */
export const PanelTabs = <K extends string>({
  items,
  current,
  onChange,
  label,
  className,
}: {
  items: PanelTab<K>[];
  current: K;
  onChange: (key: K) => void;
  label: string;
  className?: string;
}) => {
  const id = useId();
  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') {
      return;
    }
    const i = items.findIndex((t) => t.key === current);
    const next =
      items[
        (i + (e.key === 'ArrowRight' ? 1 : -1) + items.length) % items.length
      ];
    onChange(next.key);
    document.getElementById(`${id}-${next.key}`)?.focus();
  };
  return (
    <div className={clsx(tabs, className)} role="tablist" aria-label={label}>
      {items.map((t) => (
        <button
          key={t.key}
          id={`${id}-${t.key}`}
          type="button"
          role="tab"
          className={tab}
          aria-selected={t.key === current}
          tabIndex={t.key === current ? 0 : -1}
          onClick={() => onChange(t.key)}
          onKeyDown={onKeyDown}
        >
          {t.label}
          {t.outage && (
            <span className={outageMark} title="サービスで障害が発生中">
              ⚠
            </span>
          )}
          {t.alert && <span className={dot} title="要確認" />}
        </button>
      ))}
    </div>
  );
};
