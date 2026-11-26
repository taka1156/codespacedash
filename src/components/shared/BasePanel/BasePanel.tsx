import {
  panel,
  panelHeader,
  panelSub,
  panelTitle,
  statBadge,
} from './style.css';

export const BasePanel = ({
  title,
  subTitle,
  icon,
  badgeText,
  tabs,
  children,
}: {
  title: string;
  subTitle?: string;
  icon: string;
  badgeText?: string;
  /** パネルの一番上に出す切り替えタブ */
  tabs?: React.ReactNode;
  children: React.ReactNode;
}) => {
  return (
    <section className={panel}>
      {tabs}
      <div className={panelHeader}>
        <div>
          <h2 className={panelTitle}>
            <span className="icon">{icon}</span> {title}
          </h2>
          {subTitle && <p className={panelSub}>{subTitle}</p>}
        </div>
        {badgeText && <div className={statBadge}>{badgeText}</div>}
      </div>
      {children}
    </section>
  );
};
