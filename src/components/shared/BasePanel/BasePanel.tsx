import {
  panel,
  panelBody,
  panelHeader,
  panelSub,
  panelTitle,
  statBadge,
} from './style.css';

/** すべてのパネルの共通の枠（ヘッダー + 中身）。中身が取れなくても枠の大きさは変えない */
export const BasePanel = ({
  title,
  subTitle,
  icon,
  badgeText,
  children,
}: {
  title: string;
  subTitle?: string;
  icon: string;
  badgeText?: string;
  children: React.ReactNode;
}) => {
  return (
    <section className={panel}>
      <div className={panelHeader}>
        <div>
          <h2 className={panelTitle}>
            <span className="icon">{icon}</span> {title}
          </h2>
          {subTitle && <p className={panelSub}>{subTitle}</p>}
        </div>
        {badgeText && <div className={statBadge}>{badgeText}</div>}
      </div>
      <div className={panelBody}>{children}</div>
    </section>
  );
};
