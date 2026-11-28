import clsx from 'clsx';
import { useId } from 'react';
import { FavoritesTab } from '@/components/Settings/FavoritesTab';
import { NotificationsSection } from '@/components/Settings/NotificationsSection';
import { DebugSection, PlansSection } from '@/components/Settings/Sections';
import { TokensSection } from '@/components/Settings/TokensSection';
import { routeHref, type SettingsSection } from '@/hooks/useRoute';
import type { DebugSettings, Settings } from '@/hooks/useSettings';
import type { ResolvedPlans } from '@/lib/debug';
import { IS_STATIC_PREVIEW } from '@/lib/preview';
import type { DashboardResponse } from '@/lib/types';
import {
  back,
  backText,
  bar,
  body,
  dot,
  nav,
  navDebugOn,
  navItem,
  page,
  panel,
  title,
} from './style.css';

interface Props {
  section: SettingsSection;
  onSection: (section: SettingsSection) => void;
  settings: Settings;
  plans: ResolvedPlans;
  /** 取得前は null */
  tokens: DashboardResponse['tokens'] | null;
  /** 期限が近い・切れたトークンがあるか（メニューに点を付ける） */
  tokenAlert: boolean;
  onChange: (patch: Partial<Settings>) => void;
  onChangeDebug: (patch: Partial<DebugSettings>) => void;
}

const LABELS: Record<SettingsSection, string> = {
  plans: 'プラン',
  favorites: 'お気に入り',
  tokens: 'トークン',
  notifications: '通知',
  debug: 'デバッグ',
};

/** 設定ページ。PC は左にメニュー、スマホは上に横スクロールのタブ */
export const SettingsPage = ({
  section,
  onSection,
  settings,
  plans,
  tokens,
  tokenAlert,
  onChange,
  onChangeDebug,
}: Props) => {
  const id = useId();
  // 静的プレビューは通知（Service Worker）を使わない
  const sections = (Object.keys(LABELS) as SettingsSection[]).filter(
    (s) => !(IS_STATIC_PREVIEW && s === 'notifications'),
  );
  const current = sections.includes(section) ? section : 'plans';
  const debugOn = settings.debug.enabled;

  return (
    <div className={page}>
      <header className={bar}>
        <a className={back} href={routeHref({ page: 'dashboard' })}>
          ← <span className={backText}>ダッシュボード</span>
        </a>
        <h1 className={title}>設定</h1>
      </header>
      <main className={body}>
        <div className={nav} role="tablist" aria-label="設定の項目">
          {sections.map((s) => (
            <button
              key={s}
              type="button"
              role="tab"
              id={`${id}-${s}`}
              aria-selected={current === s}
              aria-controls={`${id}-panel`}
              className={clsx(navItem, s === 'debug' && debugOn && navDebugOn)}
              onClick={() => onSection(s)}
            >
              {s === 'debug' && debugOn ? 'デバッグ ●' : LABELS[s]}
              {s === 'tokens' && tokenAlert && (
                <span className={dot} title="要確認" />
              )}
            </button>
          ))}
        </div>
        <div
          className={panel}
          role="tabpanel"
          id={`${id}-panel`}
          aria-labelledby={`${id}-${current}`}
        >
          {current === 'plans' ? (
            <PlansSection
              settings={settings}
              plans={plans}
              onChange={onChange}
            />
          ) : current === 'favorites' ? (
            <FavoritesTab
              favorites={settings.favorites}
              onChange={(favorites) => onChange({ favorites })}
            />
          ) : current === 'tokens' ? (
            <TokensSection tokens={tokens} />
          ) : current === 'notifications' ? (
            <NotificationsSection />
          ) : (
            <DebugSection
              debug={settings.debug}
              onChangeDebug={onChangeDebug}
            />
          )}
        </div>
      </main>
    </div>
  );
};
