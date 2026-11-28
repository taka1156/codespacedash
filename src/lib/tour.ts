import { type DriveStep, driver } from 'driver.js';
import 'driver.js/dist/driver.css';
import type { ServiceTab } from '@/hooks/useSettings';
import { tourPopover } from './tour.css';

/** ツアーで指す要素には data-tour を付けておく */
export const tourTarget = (name: string) => `[data-tour="${name}"]`;

/** 開いているタブのパネル（左から n 番目、1 始まり） */
const panel = (n: number) => `${tourTarget('panels')} > :nth-child(${n})`;

interface Step {
  element: string;
  title: string;
  description: string;
}

const TABS: Step = {
  element: tourTarget('tabs'),
  title: 'サービスの切り替え',
  description:
    'GitHub・Cloudflare・PR を切り替えます。失敗したジョブがあると赤い点、公式ステータスページで障害が出ていると ⚠ が付きます。',
};

const PANELS: Record<ServiceTab, Step[]> = {
  github: [
    {
      element: panel(1),
      title: 'Codespaces',
      description:
        'Codespace の一覧と今月の使用時間・ストレージです。止め忘れは停止ボタンで止められ、プッシュ通知でも知らせます。',
    },
    {
      element: panel(2),
      title: 'Actions',
      description:
        '今月の Actions の実行時間（分）と、最近の実行履歴です。失敗した実行は赤で表示します。',
    },
    {
      element: panel(3),
      title: 'Copilot',
      description: '今月の Copilot のプレミアムリクエストの使用量です。',
    },
  ],
  cloudflare: [
    {
      element: panel(1),
      title: 'Workers Builds',
      description: 'Git 連携した Worker のビルド履歴と、今月のビルド時間です。',
    },
    {
      element: panel(2),
      title: '日次の無料枠',
      description:
        'Workers のリクエストなど、毎日 9:00 にリセットされる無料枠の使用量です。',
    },
    {
      element: panel(3),
      title: 'ストレージ・月次',
      description: 'R2 の月次の操作回数と、D1・KV・R2 の今の保存量です。',
    },
  ],
  pulls: [
    {
      element: panel(1),
      title: 'オープンな PR',
      description:
        'お気に入りに登録したリポジトリのオープンな PR です。リポジトリは設定の「お気に入り」で追加できます。',
    },
  ],
};

const TAIL: Step[] = [
  {
    element: tourTarget('refresh'),
    title: '更新',
    description: '最新の値を取り直します。',
  },
  {
    element: tourTarget('settings'),
    title: '設定',
    description:
      'プラン・トークンの期限・お気に入り・通知などを設定します。確認が必要なことがあると黄色い点が付きます。',
  },
  {
    element: tourTarget('help'),
    title: '使い方',
    description: 'このツアーはいつでもここから見直せます。',
  },
];

/** 開いているタブのツアー。画面にまだない要素（読み込み中のパネルなど）は飛ばす */
export const tourSteps = (tab: ServiceTab): DriveStep[] =>
  [TABS, ...PANELS[tab], ...TAIL]
    .filter((s) => document.querySelector(s.element))
    .map(({ element, title, description }) => ({
      element,
      popover: { title, description },
    }));

/** ヘルプボタンから使い方のツアーを始める */
export const startTour = (tab: ServiceTab) => {
  const tour = driver({
    steps: tourSteps(tab),
    popoverClass: tourPopover,
    showProgress: true,
    progressText: '{{current}} / {{total}}',
    nextBtnText: '次へ',
    prevBtnText: '戻る',
    doneBtnText: '完了',
    closeBtnLabel: '閉じる',
    overlayColor: '#000',
    overlayOpacity: 0.6,
    stagePadding: 6,
    stageRadius: 10,
  });
  tour.drive();
  return tour;
};
