import { type KeyboardEvent, useId } from 'react';
import { dot, tab, tabs } from './style.css';

export interface PanelTab<K extends string> {
  key: K;
  label: string;
  /** 失敗があるときなどに赤い点を出す */
  alert?: boolean;
}

/** パネルの中身を切り替えるタブ（左右キーでも移動できる） */
export const PanelTabs = <K extends string>({
  items,
  current,
  onChange,
  label,
}: {
  items: PanelTab<K>[];
  current: K;
  onChange: (key: K) => void;
  label: string;
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
    <div className={tabs} role="tablist" aria-label={label}>
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
          {t.alert && <span className={dot} title="失敗あり" />}
        </button>
      ))}
    </div>
  );
};
