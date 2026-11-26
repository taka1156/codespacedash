// Workers Builds の集計（API を呼ばない純粋な関数だけ。テストしやすいよう cloudflare.ts から分けている）
import type { WorkerBuild, WorkersPlan } from '../../shared/types';

export interface Period {
  start: string;
  end: string;
}

/** account limits の応答。Free プランのときだけ中身が入る */
export interface AccountLimits {
  build_minutes_refresh_on?: string | null;
  has_reached_build_minutes_limit?: boolean | null;
}

/**
 * プランを推定する。limits の2項目は「Free プランのときだけ返る」と
 * ドキュメントにあるので、どちらかがあれば Free、どちらもなければ有料とみなす。
 */
export const detectPlan = (
  limits: AccountLimits | null,
): WorkersPlan | null => {
  if (!limits) {
    return null;
  }
  return limits.build_minutes_refresh_on != null ||
    limits.has_reached_build_minutes_limit != null
    ? 'free'
    : 'paid';
};

/** タイムゾーンでの「今の年月日時分秒」を UTC として読んだ値と、実際の時刻との差（ミリ秒） */
const tzOffsetMs = (date: Date, timeZone: string) => {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hourCycle: 'h23',
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    hour: 'numeric',
    minute: 'numeric',
    second: 'numeric',
  }).formatToParts(date);
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value);
  const asUtc = Date.UTC(
    get('year'),
    get('month') - 1,
    get('day'),
    get('hour'),
    get('minute'),
    get('second'),
  );
  return asUtc - Math.floor(date.getTime() / 1000) * 1000;
};

/**
 * 集計期間。Free はビルド時間のリセット日（build_minutes_refresh_on）の1か月前から、
 * リセット日がわからなければタイムゾーン基準の今月。
 */
export const billingPeriod = (
  refreshOn: string | null | undefined,
  timeZone: string,
  now: Date = new Date(),
): Period => {
  if (refreshOn) {
    const end = new Date(refreshOn);
    if (!Number.isNaN(end.getTime())) {
      const start = new Date(end);
      start.setUTCMonth(start.getUTCMonth() - 1);
      return { start: start.toISOString(), end: end.toISOString() };
    }
  }
  const offset = tzOffsetMs(now, timeZone);
  const local = new Date(now.getTime() + offset);
  const y = local.getUTCFullYear();
  const m = local.getUTCMonth();
  return {
    start: new Date(Date.UTC(y, m, 1) - offset).toISOString(),
    end: new Date(Date.UTC(y, m + 1, 1) - offset).toISOString(),
  };
};

/** 1回のビルドの分数（端数は切り上げ。待機中は数えない） */
export const buildMinutes = (b: WorkerBuild, now: Date = new Date()) => {
  if (b.status === 'queued') {
    return 0;
  }
  const start = new Date(b.startedAt ?? b.createdAt).getTime();
  const end = b.stoppedAt ? new Date(b.stoppedAt).getTime() : now.getTime();
  const ms = end - start;
  return ms > 0 ? Math.ceil(ms / 60_000) : 0;
};

export const inPeriod = (b: WorkerBuild, period: Period) => {
  const t = new Date(b.createdAt).getTime();
  return (
    t >= new Date(period.start).getTime() && t < new Date(period.end).getTime()
  );
};

export const usedMinutes = (
  builds: WorkerBuild[],
  period: Period,
  now: Date = new Date(),
) =>
  builds
    .filter((b) => inPeriod(b, period))
    .reduce((sum, b) => sum + buildMinutes(b, now), 0);
