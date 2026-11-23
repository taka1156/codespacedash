import clsx from 'clsx';
import {
  Bar,
  BarChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { CLAUDE_PLANS, CLAUDE_USAGE_URL, type ClaudePlan } from '@/lib/plans';
import type { ClaudeTokens, ClaudeUsage } from '@/lib/types';
import { BasePanel } from '../shared/BasePanel/BasePanel';
import {
  accentClaude,
  accentGreen,
  chartWrap,
  dot,
  legendGrid,
  legendItem,
  legendValue,
  linkButton,
  linkRow,
  linkSub,
  modelCost,
  modelList,
  modelMeta,
  modelName,
  modelRow,
  note,
  noteIcon,
  section,
  sectionTitle,
  shareFill,
  shareTrack,
  stackBar,
  tile,
  tileLabel,
  tileSub,
  tiles,
  tileValue,
  tokenColor,
} from './style.css';

interface Props {
  usage: ClaudeUsage | null;
  configured: boolean;
  plan: ClaudePlan;
}

const TOKEN_KINDS: { key: keyof ClaudeTokens; label: string }[] = [
  { key: 'input', label: '入力' },
  { key: 'cacheWrite', label: 'キャッシュ書込' },
  { key: 'cacheRead', label: 'キャッシュ読込' },
  { key: 'output', label: '出力' },
];

const TOKEN_HEX: Record<keyof ClaudeTokens, string> = {
  input: '#d97757',
  cacheWrite: '#e8b04a',
  cacheRead: '#6b8f71',
  output: '#c9a7f5',
};

const fmtTokens = (n: number) => {
  if (n >= 1e9) {
    return `${(n / 1e9).toFixed(2)}B`;
  }
  if (n >= 1e6) {
    return `${(n / 1e6).toFixed(2)}M`;
  }
  if (n >= 1e3) {
    return `${(n / 1e3).toFixed(1)}K`;
  }
  return String(n);
};

const fmtUsd = (n: number) =>
  n >= 100
    ? `$${n.toFixed(0)}`
    : n >= 1
      ? `$${n.toFixed(2)}`
      : `$${n.toFixed(3)}`;

const sum = (t: ClaudeTokens) =>
  t.input + t.cacheWrite + t.cacheRead + t.output;

const prettyModel = (id: string) => {
  const parts = id
    .replace(/^claude-/, '')
    .replace(/-\d{8}$/, '')
    .split('-');
  const words = parts.filter((p) => !/^\d+$/.test(p));
  const nums = parts.filter((p) => /^\d+$/.test(p));
  if (words.length === 0) {
    return id;
  }
  const name = words.map((w) => w[0].toUpperCase() + w.slice(1)).join(' ');
  return nums.length ? `${name} ${nums.join('.')}` : name;
};

const Note = ({ children }: { children: React.ReactNode }) => (
  <div className={note}>
    <span className={noteIcon}>💡</span>
    <div>{children}</div>
  </div>
);

const SubscriptionCard = ({ plan }: { plan: ClaudePlan }) => {
  const { label, monthlyUsd, multiplier } = CLAUDE_PLANS[plan];
  return (
    <BasePanel
      title="Claude"
      icon="✳"
      subTitle="サブスクリプション"
      badgeText={label}
    >
      <div className={tiles}>
        <div className={tile}>
          <span className={tileLabel}>プラン</span>
          <span className={clsx(tileValue, accentClaude)}>
            {label.replace('Claude ', '')}
          </span>
        </div>
        <div className={tile}>
          <span className={tileLabel}>月額</span>
          <span className={tileValue}>${monthlyUsd}</span>
        </div>
        <div className={tile}>
          <span className={tileLabel}>使用枠</span>
          <span className={tileValue}>
            {multiplier === 1 ? '基準' : `${multiplier}倍`}
          </span>
          <span className={tileSub}>Pro 比</span>
        </div>
      </div>
      <div className={section}>
        <Note>
          Pro / Max の使用量（5時間ごとの枠と週ごとの上限）は公式 API
          がないため、ここには表示できません。claude.ai
          の使用量ページで確認してください。
        </Note>
      </div>
      <div className={linkRow}>
        <a
          className={linkButton}
          href={CLAUDE_USAGE_URL}
          target="_blank"
          rel="noopener noreferrer"
        >
          claude.ai で使用量を見る ↗
        </a>
        <span className={linkSub}>
          Claude Code では <code>/usage</code>
        </span>
      </div>
    </BasePanel>
  );
};

export const ClaudePanel = ({ usage, configured, plan }: Props) => {
  const { label: planLabel, monthlyUsd } = CLAUDE_PLANS[plan];
  const subTitle = 'Claude API 使用状況（今月）';

  if (monthlyUsd !== null) {
    return <SubscriptionCard plan={plan} />;
  }

  if (!configured) {
    return (
      <BasePanel
        title="Claude"
        icon="✳"
        subTitle={subTitle}
        badgeText={planLabel}
      >
        <Note>
          Worker のシークレットに <code>ANTHROPIC_ADMIN_KEY</code>（Admin API
          キー <code>sk-ant-admin01-…</code>）を設定すると、
          モデル別のトークン数・キャッシュ効率・費用が表示されます
        </Note>
      </BasePanel>
    );
  }

  if (!usage) {
    return (
      <BasePanel
        title="Claude"
        icon="✳"
        subTitle={subTitle}
        badgeText={planLabel}
      >
        <Note>使用状況を取得できませんでした</Note>
      </BasePanel>
    );
  }

  const totals = usage.models.reduce<ClaudeTokens>(
    (t, m) => ({
      input: t.input + m.input,
      cacheWrite: t.cacheWrite + m.cacheWrite,
      cacheRead: t.cacheRead + m.cacheRead,
      output: t.output + m.output,
    }),
    { input: 0, cacheWrite: 0, cacheRead: 0, output: 0 },
  );
  const totalTokens = sum(totals);
  const inputSide = totals.input + totals.cacheWrite + totals.cacheRead;
  const cacheHit = inputSide > 0 ? totals.cacheRead / inputSide : null;
  const cost = usage.totalCostUsd;
  const badge = planLabel;

  if (totalTokens === 0 && !cost) {
    return (
      <BasePanel title="Claude" icon="✳" subTitle={subTitle} badgeText={badge}>
        <Note>今月の Claude API の利用はまだありません</Note>
      </BasePanel>
    );
  }

  const hasCost = cost !== null;
  const activeDays = usage.daily.filter((d) => sum(d) > 0).length;
  const chartData = usage.daily.map((d) => ({
    ...d,
    day: Number(d.date.slice(8, 10)),
    cost: d.costUsd ?? 0,
    tokens: sum(d),
  }));
  const topTokens = Math.max(1, ...usage.models.map(sum));

  return (
    <BasePanel title="Claude" icon="✳" subTitle={subTitle} badgeText={badge}>
      <div className={tiles}>
        <div className={tile}>
          <span className={tileLabel}>コスト</span>
          <span className={clsx(tileValue, accentClaude)}>
            {hasCost ? fmtUsd(cost) : '—'}
          </span>
          <span className={tileSub}>
            {hasCost && activeDays > 0
              ? `${fmtUsd(cost / activeDays)} / 日`
              : '取得できません'}
          </span>
        </div>
        <div className={tile}>
          <span className={tileLabel}>トークン</span>
          <span className={tileValue}>{fmtTokens(totalTokens)}</span>
          <span className={tileSub}>出力 {fmtTokens(totals.output)}</span>
        </div>
        <div className={tile}>
          <span className={tileLabel}>キャッシュ率</span>
          <span
            className={clsx(
              tileValue,
              cacheHit !== null && cacheHit >= 0.5 && accentGreen,
            )}
          >
            {cacheHit === null ? '—' : `${Math.round(cacheHit * 100)}%`}
          </span>
          <span className={tileSub}>入力のうち読込</span>
        </div>
      </div>

      <div className={section}>
        <p className={sectionTitle}>トークン構成</p>
        <div className={stackBar} aria-hidden="true">
          {TOKEN_KINDS.map(({ key }) =>
            totals[key] > 0 ? (
              <div
                key={key}
                className={tokenColor[key]}
                style={{ flexGrow: totals[key], minWidth: 3 }}
              />
            ) : null,
          )}
        </div>
        <div className={legendGrid}>
          {TOKEN_KINDS.map(({ key, label }) => (
            <div key={key} className={legendItem}>
              <span className={clsx(dot, tokenColor[key])} />
              {label}
              <span className={legendValue}>{fmtTokens(totals[key])}</span>
            </div>
          ))}
        </div>
      </div>

      <div className={section}>
        <p className={sectionTitle}>モデル別</p>
        <div className={modelList}>
          {usage.models.map((m) => {
            const t = sum(m);
            return (
              <div key={m.model} className={modelRow}>
                <span className={modelName} title={m.model}>
                  {prettyModel(m.model)}
                </span>
                <span className={modelCost}>
                  {m.costUsd === null ? '—' : fmtUsd(m.costUsd)}
                </span>
                <div className={shareTrack} aria-hidden="true">
                  <div
                    className={shareFill}
                    style={{ width: `${(t / topTokens) * 100}%` }}
                  />
                </div>
                <span className={modelMeta}>
                  <span>計 {fmtTokens(t)}</span>
                  <span>
                    入 {fmtTokens(m.input + m.cacheWrite + m.cacheRead)}
                  </span>
                  <span>出 {fmtTokens(m.output)}</span>
                  {m.webSearchRequests > 0 && (
                    <span>🔍 {m.webSearchRequests.toLocaleString()}</span>
                  )}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {chartData.length > 1 && (
        <div className={chartWrap}>
          <p className={sectionTitle}>
            {hasCost ? '日別コスト' : '日別トークン'}
          </p>
          <ResponsiveContainer width="100%" height={110}>
            {hasCost ? (
              <BarChart
                data={chartData}
                margin={{ top: 4, right: 4, left: -18, bottom: 0 }}
              >
                <XAxis
                  dataKey="day"
                  tick={{ fontSize: 10, fill: '#7d8590' }}
                  axisLine={false}
                  tickLine={false}
                  interval="preserveStartEnd"
                />
                <YAxis
                  tick={{ fontSize: 10, fill: '#7d8590' }}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={(v: number) => `$${v}`}
                />
                <Tooltip
                  cursor={{ fill: 'rgba(255,255,255,0.04)' }}
                  contentStyle={{
                    background: '#0f1117',
                    border: '1px solid rgba(255,255,255,0.1)',
                    borderRadius: 8,
                    fontSize: 12,
                  }}
                  labelFormatter={(_, p) => p?.[0]?.payload?.date ?? ''}
                  itemStyle={{ color: '#f1f5f9' }}
                  formatter={(v, _n, p) => [
                    `${fmtUsd(Number(v))}（${fmtTokens(Number(p.payload?.tokens ?? 0))} tok）`,
                    '',
                  ]}
                />
                <Bar
                  dataKey="cost"
                  fill={TOKEN_HEX.input}
                  radius={[3, 3, 0, 0]}
                />
              </BarChart>
            ) : (
              <BarChart
                data={chartData}
                margin={{ top: 4, right: 4, left: -18, bottom: 0 }}
              >
                <XAxis
                  dataKey="day"
                  tick={{ fontSize: 10, fill: '#7d8590' }}
                  axisLine={false}
                  tickLine={false}
                  interval="preserveStartEnd"
                />
                <YAxis
                  tick={{ fontSize: 10, fill: '#7d8590' }}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={fmtTokens}
                />
                <Tooltip
                  cursor={{ fill: 'rgba(255,255,255,0.04)' }}
                  contentStyle={{
                    background: '#0f1117',
                    border: '1px solid rgba(255,255,255,0.1)',
                    borderRadius: 8,
                    fontSize: 12,
                  }}
                  itemStyle={{ color: '#f1f5f9' }}
                  formatter={(v) => [fmtTokens(Number(v)), '']}
                />
                {TOKEN_KINDS.map(({ key }) => (
                  <Bar
                    key={key}
                    dataKey={key}
                    stackId="t"
                    fill={TOKEN_HEX[key]}
                  />
                ))}
              </BarChart>
            )}
          </ResponsiveContainer>
        </div>
      )}
    </BasePanel>
  );
};
