import type { WorkerBuild, WorkersBuildsSummary } from '../../shared/types';
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

const cf = async <T>(env: Env, path: string): Promise<Envelope<T>> => {
  if (!workersConfigured(env)) {
    throw new CloudflareError(
      500,
      'CLOUDFLARE_API_TOKEN / CLOUDFLARE_ACCOUNT_ID が設定されていません',
    );
  }
  const res = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${encodeURIComponent(env.CLOUDFLARE_ACCOUNT_ID ?? '')}${path}`,
    {
      headers: {
        Authorization: `Bearer ${env.CLOUDFLARE_API_TOKEN}`,
        'User-Agent': 'codespacedash',
      },
    },
  );
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

const WORKERS_LIMIT = 30;
const LATEST_CHUNK = 20;
const BUILDS_PER_PAGE = 50;
const BUILDS_MAX_PAGES = 3;
const BUILDS_LIMIT = 10;
const CACHE_SEC = 60;

const toBuild = (env: Env, worker: string, b: RawBuild): WorkerBuild => {
  const m = b.build_trigger_metadata ?? {};
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
    dashboardUrl: `https://dash.cloudflare.com/${env.CLOUDFLARE_ACCOUNT_ID}/workers/services/view/${encodeURIComponent(worker)}/production/builds/${b.build_uuid}`,
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

/** 1つの Worker のビルドを、集計期間の始まりまでさかのぼって取る */
const listBuilds = async (env: Env, script: RawScript, period: Period) => {
  const out: WorkerBuild[] = [];
  const start = new Date(period.start).getTime();
  for (let page = 1; page <= BUILDS_MAX_PAGES; page++) {
    const res = await cf<RawBuild[]>(
      env,
      `/builds/workers/${encodeURIComponent(script.tag)}/builds?page=${page}&per_page=${BUILDS_PER_PAGE}`,
    );
    const builds = (res.result ?? []).map((b) => toBuild(env, script.id, b));
    out.push(...builds);
    const oldest = builds.at(-1);
    const totalPages = res.result_info?.total_pages ?? page;
    if (
      builds.length < BUILDS_PER_PAGE ||
      page >= totalPages ||
      !oldest ||
      new Date(oldest.createdAt).getTime() < start
    ) {
      break;
    }
  }
  return out;
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
