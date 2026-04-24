import clsx from 'clsx';
import {
  Bar,
  BarChart,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { PremiumRequestUsage } from '@/lib/types';
import { BasePanel } from '../shared/BasePanel/BasePanel';
import {
  accentCyan,
  accentGreen,
  accentOrange,
  billingGrid,
  billingStats,
  breakdownTitle,
  breakdownWrap,
  bstat,
  bstatLabel,
  bstatVal,
  copilotCard,
  copilotGrid,
  copilotIcon,
  copilotLabel,
  copilotModelItem,
  copilotModelList,
  copilotPremiumNote,
  copilotValSmall,
  modelCount,
  modelDot,
  modelName,
} from './style.css';

interface Props {
  premiumRequests: PremiumRequestUsage | null;
}

const MODEL_COLORS = [
  '#22d3ee',
  '#a78bfa',
  '#f97316',
  '#4ade80',
  '#fbbf24',
  '#f87171',
];

export const CopilotPanel = ({ premiumRequests }: Props) => {
  // モデル別集計
  const modelData = (premiumRequests?.usageItems ?? []).map((item, i) => ({
    name: item.model,
    requests: item.grossQuantity,
    cost: item.netAmount,
    color: MODEL_COLORS[i % MODEL_COLORS.length],
  }));

  const totalRequests = modelData.reduce((s, d) => s + d.requests, 0);
  const totalCost = modelData.reduce((s, d) => s + d.cost, 0);

  if (!premiumRequests || modelData.length === 0) {
    return (
      <BasePanel title="Copilot" icon="✦" subTitle="AIコーディングアシスタント">
        <div className={copilotGrid}>
          <div className={`${copilotCard} ${copilotPremiumNote}`}>
            <span className={copilotIcon}>💡</span>
            <div>
              <p className={copilotLabel}>プレミアムリクエスト</p>
              <p className={copilotValSmall}>
                Fine-grained PAT に <code>Plan (read)</code> 権限を付与すると、
                モデル別リクエスト数・費用が表示されます
              </p>
            </div>
          </div>
        </div>
      </BasePanel>
    );
  }

  return (
    <BasePanel title="Copilot" icon="✦" subTitle="AIコーディングアシスタント">
      <div className={billingGrid} style={{ marginBottom: 16 }}>
        <div className={billingStats}>
          <div className={bstat}>
            <span className={bstatLabel}>プレミアムリクエスト合計</span>
            <span className={`${bstatVal} ${accentCyan}`}>
              {totalRequests.toLocaleString()} 回
            </span>
          </div>
          <div className={bstat}>
            <span className={bstatLabel}>請求額（純額）</span>
            <span
              className={clsx(
                bstatVal,
                totalCost > 0 ? accentOrange : accentGreen,
              )}
            >
              {totalCost > 0 ? `$${totalCost.toFixed(4)}` : '無料枠内'}
            </span>
          </div>
          <div className={bstat}>
            <span className={bstatLabel}>使用モデル数</span>
            <span className={bstatVal}>{modelData.length} モデル</span>
          </div>
        </div>

        {/* モデル別一覧 */}
        <div className={copilotModelList}>
          {modelData.map((d) => (
            <div key={d.name} className={copilotModelItem}>
              <span className={modelDot} style={{ background: d.color }} />
              <span className={modelName}>{d.name}</span>
              <span className={modelCount}>{d.requests.toLocaleString()}</span>
            </div>
          ))}
        </div>
      </div>

      {/* モデル別棒グラフ */}
      {modelData.length > 1 && (
        <div className={breakdownWrap}>
          <p className={breakdownTitle}>モデル別リクエスト数</p>
          <ResponsiveContainer width="100%" height={100}>
            <BarChart
              data={modelData}
              margin={{ top: 4, right: 8, left: -20, bottom: 0 }}
            >
              <XAxis
                dataKey="name"
                tick={{ fontSize: 10, fill: '#7d8590' }}
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
                formatter={(v: number) => [`${v.toLocaleString()} 回`, '']}
              />
              <Bar dataKey="requests" radius={[4, 4, 0, 0]}>
                {modelData.map((d) => (
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
