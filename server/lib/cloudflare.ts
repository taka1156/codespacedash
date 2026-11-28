import type {
  TokenInfo,
  WorkerBuild,
  WorkersBuildsSummary,
} from '../../shared/types';
import type { Env } from '../env';
import {
  type AccountLimits,
  billingPeriod,
  detectPlan,
  type Period,
  usedMinutes,
} from './workersBuilds';

export class CloudflareError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

export const workersConfigured = (env: Env) =>
  Boolean(env.CLOUDFLARE_API_TOKEN && env.CLOUDFLARE_ACCOUNT_ID);

interface Envelope<T> {
  success: boolean;
  errors?: { code?: number; message?: string }[];
  result: T;
  result_info?: { page?: number; total_pages?: number };
}

const API = 'https://api.cloudflare.com/client/v4';

/** url は API のベースからのパス（アカウント単位なら /accounts/{id}/…） */
const cfFetch = async <T>(token: string, url: string): Promise<Envelope<T>> => {
  const res = await fetch(`${API}${url}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      'User-Agent': 'codespacedash',
    },
  });
  let body: Envelope<T> | null = null;
  try {
    body = (await res.json()) as Envelope<T>;
  } catch {}
  if (!res.ok || !body?.success) {
    let message = `Cloudflare API ${res.status}`;
    const detail = body?.errors?.[0]?.message;
    if (detail) {
      message += `: ${detail}`;
    }
    // 「Invalid token」は 400 で返ることもあるので、権限不足（403）として扱う
    const forbidden =
      res.status === 401 || res.status === 403 || /token/i.test(detail ?? '');
    throw new CloudflareError(forbidden ? 403 : res.status, message);
  }
  return body;
};

const cf = async <T>(env: Env, path: string): Promise<Envelope<T>> => {
  const { CLOUDFLARE_API_TOKEN: token, CLOUDFLARE_ACCOUNT_ID: account } = env;
  if (!token || !account) {
    throw new CloudflareError(
      500,
      'CLOUDFLARE_API_TOKEN / CLOUDFLARE_ACCOUNT_ID が設定されていません',
    );
  }
  return cfFetch<T>(token, `/accounts/${encodeURIComponent(account)}${path}`);
};

// ── トークンの期限 ──

interface RawTokenVerify {
  status: 'active' | 'disabled' | 'expired' | (string & {});
  expires_on?: string | null;
}

/**
 * CLOUDFLARE_API_TOKEN の期限。Builds API 用のユーザー単位のトークンなので /user/tokens/verify で確かめる。
 * 期限切れ（expired）は期限の日時をそのまま返し、画面で「期限切れ」と出す
 */
export const getCloudflareToken = async (env: Env): Promise<TokenInfo> => {
  const token = env.CLOUDFLARE_API_TOKEN;
  if (!token) {
    throw new CloudflareError(500, 'CLOUDFLARE_API_TOKEN が設定されていません');
  }
  const { result } = await cfFetch<RawTokenVerify>(
    token,
    '/user/tokens/verify',
  );
  if (result.status !== 'active' && result.status !== 'expired') {
    throw new CloudflareError(
      403,
      `CLOUDFLARE_API_TOKEN が無効です（${result.status}）`,
    );
  }
  return { expiresAt: result.expires_on ?? null };
};

// ── API の生データ ──

interface RawScript {
  id: string;
  tag: string;
}

interface RawBuild {
  build_uuid: string;
  status: string;
  build_outcome?: string | null;
  created_on: string;
  initializing_on?: string | null;
  running_on?: string | null;
  stopped_on?: string | null;
  build_trigger_metadata?: {
    branch?: string | null;
    commit_hash?: string | null;
    commit_message?: string | null;
    build_trigger_source?: string | null;
    repo_name?: string | null;
  } | null;
  trigger?: { external_script_id?: string | null } | null;
}

interface RawPreview {
  preview_id: string;
  branch?: string | null;
}

const WORKERS_LIMIT = 30;
/** 1つの Worker で見る Preview の数（サブリクエストの上限に収めるため） */
const PREVIEWS_LIMIT = 10;
const LATEST_CHUNK = 20;
const BUILDS_PER_PAGE = 50;
const BUILDS_MAX_PAGES = 3;
const BUILDS_LIMIT = 10;
const CACHE_SEC = 60;

/**
 * preview はビルドした Preview の名前（ブランチ名）。本番のビルドなら undefined。
 * Preview のビルドはダッシュボードでも Preview のページの下にある（/previews/{名前}/builds/{uuid}）
 */
const toBuild = (
  env: Env,
  worker: string,
  b: RawBuild,
  preview?: string,
): WorkerBuild => {
  const m = b.build_trigger_metadata ?? {};
  const base = `https://dash.cloudflare.com/${env.CLOUDFLARE_ACCOUNT_ID}/workers/services/view/${encodeURIComponent(worker)}/production`;
  return {
    id: b.build_uuid,
    worker,
    status: b.status,
    outcome: b.build_outcome ?? null,
    branch: m.branch ?? null,
    commitHash: m.commit_hash ?? null,
    commitMessage: m.commit_message ?? null,
    source: m.build_trigger_source ?? null,
    repo: m.repo_name ?? null,
    createdAt: b.created_on,
    startedAt: b.initializing_on ?? b.running_on ?? null,
    stoppedAt: b.stopped_on ?? null,
    dashboardUrl:
      preview === undefined
        ? `${base}/builds/${b.build_uuid}`
        : `${base}/previews/${encodeURIComponent(preview)}/builds/${b.build_uuid}`,
  };
};

/** 全 Worker のうち、ビルド（Git 連携）がある Worker の tag を返す */
const workersWithBuilds = async (env: Env, scripts: RawScript[]) => {
  const tags = new Set<string>();
  for (let i = 0; i < scripts.length; i += LATEST_CHUNK) {
    const ids = scripts.slice(i, i + LATEST_CHUNK).map((s) => s.tag);
    const res = await cf<{
      builds?: Record<string, RawBuild> | RawBuild[];
    }>(
      env,
      `/builds/builds/latest?external_script_ids=${ids.map(encodeURIComponent).join(',')}`,
    );
    const builds = res.result?.builds ?? {};
    if (Array.isArray(builds)) {
      for (const b of builds) {
        if (b.trigger?.external_script_id) {
          tags.add(b.trigger.external_script_id);
        }
      }
    } else {
      // tag をキーにしたマップで返る
      for (const [key, b] of Object.entries(builds)) {
        tags.add(b?.trigger?.external_script_id ?? key);
      }
    }
  }
  return scripts.filter((s) => tags.has(s.tag));
};

/** ビルド一覧の path を、集計期間の始まりまでページをさかのぼって取る */
const pagedBuilds = async (
  env: Env,
  path: string,
  period: Period,
  map: (b: RawBuild) => WorkerBuild,
) => {
  const out: WorkerBuild[] = [];
  const start = new Date(period.start).getTime();
  for (let page = 1; page <= BUILDS_MAX_PAGES; page++) {
    const res = await cf<RawBuild[]>(
      env,
      `${path}?page=${page}&per_page=${BUILDS_PER_PAGE}`,
    );
    const builds = (res.result ?? []).map(map);
    out.push(...builds);
    const totalPages = res.result_info?.total_pages ?? page;
    if (
      builds.length < BUILDS_PER_PAGE ||
      page >= totalPages ||
      // ここに来るのは1ページ分（50件）あるときだけなので、最後の要素は必ずある
      new Date(builds[builds.length - 1].createdAt).getTime() < start
    ) {
      break;
    }
  }
  return out;
};

/**
 * Preview（本番以外のブランチ）のビルド。Worker Previews のビルドは
 * /builds/workers/{tag}/builds には入らず、Preview ごとの一覧にだけ入る。
 * Preview を使っていない Worker もあるので、取れなければ空にする
 */
const listPreviewBuilds = async (
  env: Env,
  script: RawScript,
  period: Period,
) => {
  const base = `/builds/workers/${encodeURIComponent(script.tag)}/previews`;
  let previews: RawPreview[];
  try {
    previews =
      (await cf<RawPreview[]>(env, `${base}?per_page=${PREVIEWS_LIMIT}`))
        .result ?? [];
  } catch {
    return [];
  }
  const results = await Promise.allSettled(
    previews
      .slice(0, PREVIEWS_LIMIT)
      .map((p) =>
        pagedBuilds(
          env,
          `${base}/${encodeURIComponent(p.preview_id)}/builds`,
          period,
          (b) => toBuild(env, script.id, b, p.branch ?? p.preview_id),
        ),
      ),
  );
  return results.flatMap((r) => (r.status === 'fulfilled' ? r.value : []));
};

/** 1つの Worker のビルド（本番 + Preview）。本番の一覧が取れなければエラー */
const listBuilds = async (env: Env, script: RawScript, period: Period) => {
  const [production, previews] = await Promise.all([
    pagedBuilds(
      env,
      `/builds/workers/${encodeURIComponent(script.tag)}/builds`,
      period,
      (b) => toBuild(env, script.id, b),
    ),
    listPreviewBuilds(env, script, period),
  ]);
  // 両方に同じビルドが入っていても1回だけ数える
  const ids = new Set(production.map((b) => b.id));
  return [...production, ...previews.filter((b) => !ids.has(b.id))];
};

const getLimits = async (env: Env): Promise<AccountLimits | null> => {
  try {
    return (
      (await cf<AccountLimits>(env, '/builds/account/limits')).result ?? {}
    );
  } catch {
    // limits が取れなくてもビルド一覧は出す（プランは自動判定できないだけ）
    return null;
  }
};

const fetchSummary = async (env: Env): Promise<WorkersBuildsSummary> => {
  const [scriptsRes, limits] = await Promise.all([
    cf<RawScript[]>(env, '/workers/scripts'),
    getLimits(env),
  ]);
  const period = billingPeriod(
    limits?.build_minutes_refresh_on,
    env.TIMEZONE ?? 'Asia/Tokyo',
  );
  const scripts = await workersWithBuilds(
    env,
    (scriptsRes.result ?? []).filter((s) => s.tag),
  );

  const results = await Promise.allSettled(
    scripts.slice(0, WORKERS_LIMIT).map((s) => listBuilds(env, s, period)),
  );
  const failures = results.filter(
    (r): r is PromiseRejectedResult => r.status === 'rejected',
  );
  if (scripts.length > 0 && failures.length === results.length) {
    throw failures[0].reason;
  }
  const all = results
    .flatMap((r) => (r.status === 'fulfilled' ? r.value : []))
    .sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    );

  return {
    builds: all.slice(0, BUILDS_LIMIT),
    workerCount: scripts.length,
    usedMinutes: usedMinutes(all, period),
    period,
    detectedPlan: detectPlan(limits),
    limitReached: limits?.has_reached_build_minutes_limit === true,
  };
};

// Actions と同じく、メモリ → エッジキャッシュ → API の順に1分キャッシュ
let memo: { data: WorkersBuildsSummary; at: number } | null = null;

export const getWorkersBuilds = async (
  env: Env,
): Promise<WorkersBuildsSummary> => {
  if (memo && Date.now() - memo.at < CACHE_SEC * 1000) {
    return memo.data;
  }
  const cache = typeof caches !== 'undefined' ? caches.default : null;
  const key = new Request('https://codespacedash.internal/workers-builds');
  const hit = cache ? await cache.match(key) : undefined;
  if (hit) {
    const data = await hit.json<WorkersBuildsSummary>();
    memo = { data, at: Date.now() };
    return data;
  }
  const data = await fetchSummary(env);
  memo = { data, at: Date.now() };
  await cache?.put(
    key,
    new Response(JSON.stringify(data), {
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': `max-age=${CACHE_SEC}`,
      },
    }),
  );
  return data;
};
