import type {
  CloudflareDailyKey,
  CloudflareMonthlyKey,
  CloudflareUsage,
  SectionState,
} from '../../shared/types';
import type { Env } from '../env';
import { CloudflareError } from './cloudflare';
import { settle } from './section';

/** 足りないときに案内する権限名（ユーザー単位の Cloudflare API トークン） */
export const ANALYTICS_PERMISSION = 'Account Analytics: Read';

// ── 期間 ──

export interface UsagePeriods {
  /** UTC の今日 00:00（日次の無料枠のリセット時刻） */
  dayStart: string;
  /** UTC の今日（YYYY-MM-DD）。date で絞るデータセット用 */
  today: string;
  /** UTC の昨日。ストレージは日に1回程度しか記録されないので昨日から見る */
  yesterday: string;
  /** UTC の今月1日 00:00（R2 の操作回数の集計開始） */
  monthStart: string;
  now: string;
}

const ymd = (d: Date) => d.toISOString().slice(0, 10);

export const usagePeriods = (now: Date): UsagePeriods => {
  const day = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
  );
  const yesterday = new Date(day.getTime() - 86_400_000);
  const month = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  return {
    dayStart: day.toISOString(),
    today: ymd(day),
    yesterday: ymd(yesterday),
    monthStart: month.toISOString(),
    now: now.toISOString(),
  };
};

// ── R2 の操作の分類 ──

// https://developers.cloudflare.com/r2/pricing/
const CLASS_A = new Set([
  'ListBuckets',
  'PutBucket',
  'ListObjects',
  'PutObject',
  'CopyObject',
  'CompleteMultipartUpload',
  'CreateMultipartUpload',
  'LifecycleStorageTierTransition',
  'ListMultipartUploads',
  'UploadPart',
  'UploadPartCopy',
  'ListParts',
  'PutBucketEncryption',
  'PutBucketCors',
  'PutBucketLifecycleConfiguration',
]);
const CLASS_B = new Set([
  'HeadBucket',
  'HeadObject',
  'GetObject',
  'UsageSummary',
  'GetBucketEncryption',
  'GetBucketLocation',
  'GetBucketCors',
  'GetBucketLifecycleConfiguration',
]);

/** R2 の操作が Class A / B / 無料（削除など）のどれか。一覧にない操作は名前から推定する */
export const r2OperationClass = (actionType: string): 'A' | 'B' | 'free' => {
  if (CLASS_A.has(actionType)) {
    return 'A';
  }
  if (CLASS_B.has(actionType)) {
    return 'B';
  }
  if (/^(Delete|Abort)/.test(actionType)) {
    return 'free';
  }
  if (/^(Get|Head)/.test(actionType)) {
    return 'B';
  }
  // Put / List / Create / Copy / Upload / Complete など状態を変える操作
  return 'A';
};

// ── 集計 ──

const GB = 1024 ** 3;

const num = (v: unknown) =>
  typeof v === 'number' && Number.isFinite(v) ? v : 0;

/** 行ごとの値を合計する（データセットは条件しだいで複数行に分かれて返る） */
export const sumRows = <R>(
  rows: R[] | null | undefined,
  pick: (r: R) => unknown,
) => (rows ?? []).reduce((s, r) => s + num(pick(r)), 0);

/**
 * 時系列のストレージ量を、キー（バケット・DB）ごとの最新値で合計する。
 * 同じバケットを日ごとに足すと二重に数えてしまうため
 */
export const latestPerKey = <R>(
  rows: R[] | null | undefined,
  key: (r: R) => string,
  time: (r: R) => string,
  value: (r: R) => unknown,
) => {
  const latest = new Map<string, { t: string; v: number }>();
  for (const r of rows ?? []) {
    const k = key(r);
    const t = time(r);
    const prev = latest.get(k);
    if (!prev || t > prev.t) {
      latest.set(k, { t, v: num(value(r)) });
    }
  }
  let total = 0;
  for (const { v } of latest.values()) {
    total += v;
  }
  return total;
};

// ── GraphQL ──

interface GqlError {
  message?: string;
  extensions?: { code?: string };
}

/** 権限不足のエラーか（GraphQL は権限がなくても HTTP 200 で errors に入れて返すことがある） */
export const isAuthzError = (e: GqlError) =>
  /authz|unauthori[sz]ed|forbidden/i.test(e.extensions?.code ?? '') ||
  /not authori[sz]ed|unauthori[sz]ed|permission|forbidden|access denied/i.test(
    e.message ?? '',
  );

/** 1つのクエリを投げて、accounts[0] の中身を返す */
export type Gql = (
  query: string,
  variables: Record<string, unknown>,
) => Promise<Record<string, unknown>>;

export const createGql =
  (env: Env): Gql =>
  async (query, variables) => {
    const res = await fetch('https://api.cloudflare.com/client/v4/graphql', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${env.CLOUDFLARE_API_TOKEN}`,
        'Content-Type': 'application/json',
        'User-Agent': 'codespacedash',
      },
      body: JSON.stringify({
        query,
        variables: { accountTag: env.CLOUDFLARE_ACCOUNT_ID, ...variables },
      }),
    });
    return parseGqlResponse(res.status, await res.json().catch(() => null));
  };

/** GraphQL の応答から accounts[0] を取り出す。エラーは権限不足（403）とそれ以外に分ける */
export const parseGqlResponse = (
  status: number,
  body: unknown,
): Record<string, unknown> => {
  const b = body as {
    data?: { viewer?: { accounts?: Record<string, unknown>[] } } | null;
    errors?: GqlError[] | null;
  } | null;
  const errors = b?.errors ?? [];
  if (status === 401 || status === 403 || errors.some(isAuthzError)) {
    throw new CloudflareError(
      403,
      `Cloudflare GraphQL ${status}: ${errors[0]?.message ?? '権限がありません'}`,
    );
  }
  if (status >= 400 || errors.length > 0) {
    throw new CloudflareError(
      502,
      `Cloudflare GraphQL ${status}: ${errors[0]?.message ?? '応答が不正です'}`,
    );
  }
  const account = b?.data?.viewer?.accounts?.[0];
  if (!account) {
    throw new CloudflareError(
      403,
      'Cloudflare GraphQL: アカウントが見つかりません（CLOUDFLARE_ACCOUNT_ID とトークンの対象アカウントを確認してください）',
    );
  }
  return account;
};

const wrap = (body: string) => `query ($accountTag: string!, ${body}`;

// 1項目ずつ別のクエリにする。フィールド名の間違いや権限不足は、その項目だけの失敗にしたいため
const Q = {
  workers: wrap(`$start: Time!, $end: Time!) {
  viewer { accounts(filter: { accountTag: $accountTag }) {
    rows: workersInvocationsAdaptive(limit: 10000, filter: { datetime_geq: $start, datetime_lt: $end }) {
      sum { requests }
    }
  } }
}`),
  ai: wrap(`$start: Time!, $end: Time!) {
  viewer { accounts(filter: { accountTag: $accountTag }) {
    rows: aiInferenceAdaptiveGroups(limit: 10000, filter: { datetime_geq: $start, datetime_lt: $end }) {
      sum { totalNeurons }
    }
  } }
}`),
  d1: wrap(`$today: Date!) {
  viewer { accounts(filter: { accountTag: $accountTag }) {
    rows: d1AnalyticsAdaptiveGroups(limit: 10000, filter: { date_geq: $today, date_leq: $today }) {
      sum { rowsRead rowsWritten }
    }
  } }
}`),
  kv: wrap(`$today: Date!) {
  viewer { accounts(filter: { accountTag: $accountTag }) {
    rows: kvOperationsAdaptiveGroups(limit: 10000, filter: { date_geq: $today, date_leq: $today }) {
      sum { requests }
      dimensions { actionType }
    }
  } }
}`),
  r2Ops: wrap(`$start: Time!, $end: Time!) {
  viewer { accounts(filter: { accountTag: $accountTag }) {
    rows: r2OperationsAdaptiveGroups(limit: 10000, filter: { datetime_geq: $start, datetime_lt: $end }) {
      sum { requests }
      dimensions { actionType }
    }
  } }
}`),
  r2Storage: wrap(`$start: Time!, $end: Time!) {
  viewer { accounts(filter: { accountTag: $accountTag }) {
    rows: r2StorageAdaptiveGroups(limit: 10000, filter: { datetime_geq: $start, datetime_lt: $end }, orderBy: [datetime_DESC]) {
      max { payloadSize metadataSize }
      dimensions { datetime bucketName }
    }
  } }
}`),
  kvStorage: wrap(`$from: Date!, $to: Date!) {
  viewer { accounts(filter: { accountTag: $accountTag }) {
    rows: kvStorageAdaptiveGroups(limit: 10000, filter: { date_geq: $from, date_leq: $to }) {
      max { byteCount }
      dimensions { date namespaceId }
    }
  } }
}`),
  d1Storage: wrap(`$from: Date!, $to: Date!) {
  viewer { accounts(filter: { accountTag: $accountTag }) {
    rows: d1StorageAdaptiveGroups(limit: 10000, filter: { date_geq: $from, date_leq: $to }) {
      max { databaseSizeBytes }
      dimensions { date databaseId }
    }
  } }
}`),
};

type Row = {
  sum?: Record<string, unknown>;
  max?: Record<string, unknown>;
  dimensions?: Record<string, string>;
};

const rowsOf = (account: Record<string, unknown>) =>
  (account.rows ?? []) as Row[];

/** 無料枠の使用量を項目ごとに取る。1項目が失敗しても他の項目は返す */
export const fetchCloudflareUsage = async (
  gql: Gql,
  now = new Date(),
): Promise<CloudflareUsage> => {
  const p = usagePeriods(now);
  const today = { start: p.dayStart, end: p.now };
  const month = { start: p.monthStart, end: p.now };
  // ストレージは記録の間隔が空くので、直近2日から各バケットの最新値を取る
  const recent = {
    start: new Date(now.getTime() - 2 * 86_400_000).toISOString(),
    end: p.now,
  };

  // 同じクエリから2項目を取るもの（D1 の読み書き、KV の読み書き、R2 の Class A/B）は1回だけ投げる
  const d1 = gql(Q.d1, { today: p.today }).then(rowsOf);
  const kv = gql(Q.kv, { today: p.today }).then(rowsOf);
  const r2Ops = gql(Q.r2Ops, month).then(rowsOf);
  // 未処理の reject にならないように（settle 側で拾う）
  for (const pr of [d1, kv, r2Ops]) {
    pr.catch(() => {});
  }

  const kvCount = (rows: Row[], action: string) =>
    sumRows(
      rows.filter((r) => r.dimensions?.actionType === action),
      (r) => r.sum?.requests,
    );
  const r2Count = (rows: Row[], cls: 'A' | 'B') =>
    sumRows(
      rows.filter(
        (r) => r2OperationClass(r.dimensions?.actionType ?? '') === cls,
      ),
      (r) => r.sum?.requests,
    );

  const item = (f: () => Promise<number>) => settle(f, ANALYTICS_PERMISSION);

  const daily: [CloudflareDailyKey, Promise<SectionState<number>>][] = [
    [
      'workersRequests',
      item(async () =>
        sumRows(rowsOf(await gql(Q.workers, today)), (r) => r.sum?.requests),
      ),
    ],
    [
      'workersAiNeurons',
      item(async () =>
        sumRows(rowsOf(await gql(Q.ai, today)), (r) => r.sum?.totalNeurons),
      ),
    ],
    ['d1RowsRead', item(async () => sumRows(await d1, (r) => r.sum?.rowsRead))],
    [
      'd1RowsWritten',
      item(async () => sumRows(await d1, (r) => r.sum?.rowsWritten)),
    ],
    ['kvReads', item(async () => kvCount(await kv, 'read'))],
    ['kvWrites', item(async () => kvCount(await kv, 'write'))],
    ['kvDeletes', item(async () => kvCount(await kv, 'delete'))],
    ['kvLists', item(async () => kvCount(await kv, 'list'))],
  ];

  const monthly: [CloudflareMonthlyKey, Promise<SectionState<number>>][] = [
    [
      'r2StorageGb',
      item(async () => {
        const rows = rowsOf(await gql(Q.r2Storage, recent));
        const bytes = latestPerKey(
          rows,
          (r) => r.dimensions?.bucketName ?? '',
          (r) => r.dimensions?.datetime ?? '',
          (r) => num(r.max?.payloadSize) + num(r.max?.metadataSize),
        );
        return bytes / GB;
      }),
    ],
    ['r2ClassA', item(async () => r2Count(await r2Ops, 'A'))],
    ['r2ClassB', item(async () => r2Count(await r2Ops, 'B'))],
    [
      'd1StorageGb',
      item(async () => {
        const rows = rowsOf(
          await gql(Q.d1Storage, { from: p.yesterday, to: p.today }),
        );
        const bytes = latestPerKey(
          rows,
          (r) => r.dimensions?.databaseId ?? '',
          (r) => r.dimensions?.date ?? '',
          (r) => r.max?.databaseSizeBytes,
        );
        return bytes / GB;
      }),
    ],
    [
      'kvStorageGb',
      item(async () => {
        const rows = rowsOf(
          await gql(Q.kvStorage, { from: p.yesterday, to: p.today }),
        );
        const bytes = latestPerKey(
          rows,
          (r) => r.dimensions?.namespaceId ?? '',
          (r) => r.dimensions?.date ?? '',
          (r) => r.max?.byteCount,
        );
        return bytes / GB;
      }),
    ],
  ];

  const resolve = async <K extends string>(
    entries: [K, Promise<SectionState<number>>][],
  ) =>
    Object.fromEntries(
      await Promise.all(entries.map(async ([k, v]) => [k, await v] as const)),
    ) as Record<K, SectionState<number>>;

  return {
    daily: await resolve(daily),
    monthly: await resolve(monthly),
    dayStart: p.dayStart,
    monthStart: p.monthStart,
  };
};

// Builds と同じく1分だけメモリに持つ（GraphQL は1回の表示で8本投げるため）
const CACHE_MS = 60_000;
let memo: { data: CloudflareUsage; at: number } | null = null;

export const getCloudflareUsage = async (env: Env) => {
  if (memo && Date.now() - memo.at < CACHE_MS) {
    return memo.data;
  }
  const data = await fetchCloudflareUsage(createGql(env));
  memo = { data, at: Date.now() };
  return data;
};
