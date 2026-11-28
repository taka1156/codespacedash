import { useCallback, useEffect, useState } from 'react';

// 画面はハッシュで切り替える（GitHub Pages の静的プレビューでもサーバー設定なしで動く）
//   #/                    ダッシュボード
//   #/settings/<section>  設定ページ

export const SETTINGS_SECTIONS = [
  'plans',
  'favorites',
  'tokens',
  'notifications',
  'debug',
] as const;
export type SettingsSection = (typeof SETTINGS_SECTIONS)[number];

export type Route =
  | { page: 'dashboard' }
  | { page: 'settings'; section: SettingsSection };

export const parseRoute = (hash: string): Route => {
  const [page, section] = hash.replace(/^#\/?/, '').split('/');
  if (page !== 'settings') {
    return { page: 'dashboard' };
  }
  return {
    page: 'settings',
    section: SETTINGS_SECTIONS.includes(section as SettingsSection)
      ? (section as SettingsSection)
      : 'plans',
  };
};

export const routeHref = (route: Route) =>
  route.page === 'settings' ? `#/settings/${route.section}` : '#/';

export const useRoute = () => {
  const [route, setRoute] = useState(() => parseRoute(location.hash));

  useEffect(() => {
    const onChange = () => {
      setRoute(parseRoute(location.hash));
      // 画面が切り替わったら先頭から見せる
      window.scrollTo(0, 0);
    };
    window.addEventListener('hashchange', onChange);
    return () => window.removeEventListener('hashchange', onChange);
  }, []);

  const navigate = useCallback((to: Route) => {
    location.hash = routeHref(to);
  }, []);

  return { route, navigate };
};
