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
import { COPILOT_PLANS, type CopilotPlan } from '@/lib/plans';
import { statusText } from '@/lib/sectionStatus';
import type { PremiumRequestUsage, SectionState } from '@/lib/types';
import { BasePanel } from '../shared/BasePanel/BasePanel';
import { QuotaBar } from '../shared/QuotaBar/QuotaBar';
import { StatusNote } from '../shared/StatusNote/StatusNote';
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
  premiumRequests: SectionState<PremiumRequestUsage>;
  plan: CopilotPlan;
}

const MODEL_COLORS = [
  '#22d3ee',
  '#a78bfa',
  '#f97316',
  '#4ade80',
  '#fbbf24',
  '#f87171',
];

export const CopilotPanel = ({ premiumRequests: state, plan }: Props) => {
  const premiumRequests = state.status === 'ok' ? state.data : null;
  // モデル別集計
  const modelData = (premiumRequests?.usageItems ?? []).map((item, i) => ({
    name: item.model,
    requests: item.grossQuantity,
    cost: item.netAmount,
    color: MODEL_COLORS[i % MODEL_COLORS.length],
  }));

  const totalRequests = modelData.reduce((s, d) => s + d.requests, 0);
  const totalCost = modelData.reduce((s, d) => s + d.cost, 0);
  const usedUsd = (premiumRequests?.usageItems ?? []).reduce(
    (s, i) => s + i.grossAmount,
    0,
  );
  const { label: planLabel, includedUsd } = COPILOT_PLANS[plan];
  const quotaLabel = `${planLabel} の AI Credits`;
  const quota =
    includedUsd === null ? null : (
      <div style={{ marginBottom: 16 }}>
        {premiumRequests ? (
          <QuotaBar
            label={quotaLabel}
            used={usedUsd}
            free={includedUsd}
            unit="USD"
          />
        ) : (
          <QuotaBar
            label={quotaLabel}
            free={includedUsd}
            unit="USD"
            unavailable={state.status === 'ok' ? '取得失敗' : statusText(state)}
          />
        )}
      </div>
    );

  if (state.status !== 'ok' || modelData.length === 0) {
    return (
      <BasePanel
        title="Copilot"
        icon="✦"
        subTitle="AIコーディングアシスタント"
        badgeText={planLabel}
      >
        {quota}
        {state.status !== 'ok' ? (
          <StatusNote state={state} what="プレミアムリクエスト" />
        ) : (
          <div className={copilotGrid}>
            <div className={`${copilotCard} ${copilotPremiumNote}`}>
              <span className={copilotIcon}>💡</span>
              <div>
                <p className={copilotLabel}>プレミアムリクエスト</p>
                <p className={copilotValSmall}>今月はまだ使われていません</p>
              </div>
            </div>
          </div>
        )}
      </BasePanel>
    );
  }

  return (
    <BasePanel
      title="Copilot"
      icon="✦"
      subTitle="AIコーディングアシスタント"
      badgeText={planLabel}
    >
      {quota}
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
                formatter={(v) => [`${Number(v).toLocaleString()} 回`, '']}
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
