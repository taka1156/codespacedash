import {
  Bar,
  BarChart,
  Cell,
  RadialBar,
  RadialBarChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { BillingUsageSummary } from '@/lib/types';
import { BasePanel } from '../shared/BasePanel/BasePanel';
import {
  accentCyan,
  accentGreen,
  accentOrange,
  billingGrid,
  billingStats,
  breakdownTitle,
  // accentRed,
  breakdownWrap,
  bstat,
  bstatLabel,
  bstatVal,
  emptyState,
  radialCenter,
  radialUnit,
  radialValue,
  radialWrap,
} from './style.css';

interface Props {
  summary: BillingUsageSummary | null;
}

const SKU_LABEL: Record<string, string> = {
  actions_linux: 'Linux',
  actions_macos: 'macOS',
  actions_windows: 'Windows',
  'Actions Linux': 'Linux',
  'Actions macOS': 'macOS',
  'Actions Windows': 'Windows',
};

const SKU_COLOR: Record<string, string> = {
  actions_linux: '#f97316',
  actions_macos: '#a78bfa',
  actions_windows: '#38bdf8',
  'Actions Linux': '#f97316',
  'Actions macOS': '#a78bfa',
  'Actions Windows': '#38bdf8',
};

export const ActionsPanel = ({ summary }: Props) => {
  // usageItems から Actions だけ抽出
  const actionItems =
    summary?.usageItems.filter((i) => i.product.toLowerCase() === 'actions') ??
    [];

  if (!summary || actionItems.length === 0) {
    return (
      <BasePanel title="Actions 使用状況" icon="⚡">
        <div className={emptyState}>
          データを取得できませんでした
          <br />
          <small>
            Fine-grained PAT に <code>Plan (read)</code> 権限が必要です
          </small>
        </div>
      </BasePanel>
    );
  }

  // 分単位の合計（unitType === "minutes"）
  const minuteItems = actionItems.filter((i) => i.unitType === 'minutes');
  const totalMinutes = minuteItems.reduce((s, i) => s + i.grossQuantity, 0);
  const totalNet = minuteItems.reduce((s, i) => s + i.netAmount, 0);

  // SKU別棒グラフ用データ
  const barData = minuteItems.map((i) => ({
    name: SKU_LABEL[i.sku] ?? i.sku,
    minutes: i.grossQuantity,
    cost: i.netAmount,
    color: SKU_COLOR[i.sku] ?? '#64748b',
  }));

  // 合計コストでゲージ（$5 = 62.5 minutes ≈ 基準）
  const gaugeVal =
    totalNet > 0
      ? Math.min((totalNet / 5) * 100, 100)
      : Math.min((totalMinutes / 2000) * 100, 100);
  const gaugeFill =
    gaugeVal > 80 ? '#ef4444' : gaugeVal > 50 ? '#f97316' : '#22d3ee';

  return (
    <BasePanel
      title="Actions 使用状況"
      icon="⚡"
      subTitle={`${summary.timePeriod.year}年${summary.timePeriod.month ?? ''}月`}
      badgeText={`${totalMinutes.toLocaleString()} 分`}
    >
      <div className={billingGrid}>
        {/* ゲージ */}
        <div className={radialWrap}>
          <ResponsiveContainer width="100%" height={180}>
            <RadialBarChart
              cx="50%"
              cy="50%"
              innerRadius="55%"
              outerRadius="80%"
              data={[{ value: gaugeVal, fill: gaugeFill }]}
              startAngle={225}
              endAngle={-45}
            >
              <RadialBar
                dataKey="value"
                cornerRadius={6}
                background={{ fill: 'rgba(255,255,255,0.04)' }}
              />
            </RadialBarChart>
          </ResponsiveContainer>
          <div className={radialCenter}>
            <span className={radialValue}>{totalMinutes.toLocaleString()}</span>
            <span className={radialUnit}>分使用</span>
          </div>
        </div>

        {/* サマリー数値 */}
        <div className={billingStats}>
          <div className={bstat}>
            <span className={bstatLabel}>合計分数</span>
            <span className={`${bstatVal} ${accentCyan}`}>
              {totalMinutes.toLocaleString()} 分
            </span>
          </div>
          <div className={bstat}>
            <span className={bstatLabel}>請求額（純額）</span>
            <span
              className={`${bstatVal} ${totalNet > 0 ? accentOrange : accentGreen}`}
            >
              {totalNet > 0 ? `$${totalNet.toFixed(4)}` : '無料枠内'}
            </span>
          </div>
          {minuteItems.map((i) => (
            <div className={bstat} key={i.sku}>
              <span className={bstatLabel}>{SKU_LABEL[i.sku] ?? i.sku}</span>
              <span
                className={bstatVal}
                style={{ color: SKU_COLOR[i.sku] ?? '#94a3b8' }}
              >
                {i.grossQuantity.toLocaleString()} 分
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* SKU別棒グラフ */}
      {barData.length > 1 && (
        <div className={breakdownWrap}>
          <p className={breakdownTitle}>OS別内訳（分）</p>
          <ResponsiveContainer width="100%" height={100}>
            <BarChart
              data={barData}
              margin={{ top: 4, right: 8, left: -20, bottom: 0 }}
            >
              <XAxis
                dataKey="name"
                tick={{ fontSize: 11, fill: '#7d8590' }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                tick={{ fontSize: 10, fill: '#7d8590' }}
                axisLine={false}
                tickLine={false}
              />
              <Tooltip
                contentStyle={{
                  background: '#0f1117',
                  border: '1px solid rgba(255,255,255,0.1)',
                  borderRadius: 8,
                }}
                itemStyle={{ color: '#f1f5f9' }}
                formatter={(v: number) => [`${v.toLocaleString()} 分`, '']}
              />
              <Bar dataKey="minutes" radius={[4, 4, 0, 0]}>
                {barData.map((d) => (
                  <Cell key={d.name} fill={d.color} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </BasePanel>
  );
};
