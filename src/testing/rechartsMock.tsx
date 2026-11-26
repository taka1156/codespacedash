// jsdom にはレイアウトがなくグラフが描かれないので、recharts を中身の見える部品に差し替える。
// 使い方: vi.mock('recharts', () => import('@/testing/rechartsMock'))
import type { ReactNode } from 'react';

type P = { children?: ReactNode; data?: unknown; dataKey?: string };

const box =
  (name: string) =>
  ({ children, data, dataKey }: P) => (
    <div
      data-chart={name}
      data-key={dataKey}
      data-values={data === undefined ? undefined : JSON.stringify(data)}
    >
      {children}
    </div>
  );

export const ResponsiveContainer = box('ResponsiveContainer');
export const BarChart = box('BarChart');
export const RadialBarChart = box('RadialBarChart');
export const Bar = box('Bar');
export const RadialBar = box('RadialBar');
export const XAxis = box('XAxis');
export const YAxis = box('YAxis');
export const Cell = ({ fill }: { fill: string }) => (
  <span data-chart="Cell" data-fill={fill} />
);

/** formatter が返す文言を出す（ホバー時の表示の代わり） */
export const Tooltip = ({
  formatter,
}: {
  formatter: (v: unknown) => [string, string];
}) => <div data-chart="Tooltip">{formatter(1234)[0]}</div>;
