import type {
  BillingUsageItem,
  BillingUsageSummary,
  Codespace,
  GithubUser,
  PremiumRequestItem,
  PremiumRequestUsage,
  WorkflowRun,
} from '../../shared/types';
import type { Env } from '../env';

export class GithubError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

const gh = async <T>(
  env: Env,
  path: string,
  init: RequestInit = {},
): Promise<T> => {
  if (!env.GITHUB_TOKEN) {
    throw new GithubError(500, 'GITHUB_TOKEN が設定されていません');
  }
  const res = await fetch(`https://api.github.com${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${env.GITHUB_TOKEN}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      // User-Agent がないと GitHub に拒否される
      'User-Agent': 'codespacedash',
    },
  });
  if (!res.ok) {
    let message = `GitHub API ${res.status}`;
    try {
      const body = (await res.json()) as { message?: string };
      if (body.message) {
        message += `: ${body.message}`;
      }
    } catch {}
    throw new GithubError(res.status, message);
  }
  return (res.status === 204 ? null : await res.json()) as T;
};

// ── ここから下はレスポンスを必要なフィールドだけに絞って返す ──

// login はトークンで固定なので isolate 内でキャッシュ
let cachedUser: { user: GithubUser; at: number } | null = null;

export const getUser = async (env: Env): Promise<GithubUser> => {
  if (cachedUser && Date.now() - cachedUser.at < 10 * 60_000) {
    return cachedUser.user;
  }
  const u = await gh<GithubUser>(env, '/user');
  const user: GithubUser = {
    login: u.login,
    name: u.name,
    avatar_url: u.avatar_url,
    html_url: u.html_url,
  };
  cachedUser = { user, at: Date.now() };
  return user;
};

interface RawCodespace extends Omit<Codespace, 'has_unpushed_changes'> {
  git_status?: {
    has_uncommitted_changes?: boolean;
    has_unpushed_changes?: boolean;
  };
}

export const listCodespaces = async (env: Env): Promise<Codespace[]> => {
  const all: RawCodespace[] = [];
  for (let page = 1; page <= 10; page++) {
    const res = await gh<{ codespaces: RawCodespace[]; total_count: number }>(
      env,
      `/user/codespaces?per_page=100&page=${page}`,
    );
    all.push(...res.codespaces);
    if (all.length >= res.total_count || res.codespaces.length === 0) {
      break;
    }
  }
  return all.map((c) => ({
    id: c.id,
    name: c.name,
    display_name: c.display_name,
    state: c.state,
    machine: c.machine
      ? {
          name: c.machine.name,
          display_name: c.machine.display_name,
          cpus: c.machine.cpus,
          memory_in_bytes: c.machine.memory_in_bytes,
          storage_in_bytes: c.machine.storage_in_bytes,
        }
      : null,
    repository: {
      full_name: c.repository.full_name,
      html_url: c.repository.html_url,
    },
    created_at: c.created_at,
    last_used_at: c.last_used_at,
    location: c.location,
    retention_expires_at: c.retention_expires_at ?? null,
    idle_timeout_minutes: c.idle_timeout_minutes ?? null,
    web_url: c.web_url,
    has_unpushed_changes: Boolean(
      c.git_status?.has_uncommitted_changes ||
        c.git_status?.has_unpushed_changes,
    ),
  }));
};

const CODESPACE_NAME = /^[A-Za-z0-9-]{1,100}$/;

export const stopCodespace = async (env: Env, name: string) => {
  if (!CODESPACE_NAME.test(name)) {
    throw new GithubError(400, 'Codespace名が不正です');
  }
  await gh(env, `/user/codespaces/${name}/stop`, { method: 'POST' });
};

/** タイムゾーン基準の「今月」 */
export const currentPeriod = (timeZone = 'Asia/Tokyo') => {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: 'numeric',
  }).formatToParts(new Date());
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value);
  return { year: get('year'), month: get('month') };
};

const pickItem = (i: BillingUsageItem): BillingUsageItem => ({
  product: i.product,
  sku: i.sku,
  unitType: i.unitType,
  pricePerUnit: i.pricePerUnit,
  grossQuantity: i.grossQuantity,
  grossAmount: i.grossAmount,
  discountQuantity: i.discountQuantity,
  discountAmount: i.discountAmount,
  netQuantity: i.netQuantity,
  netAmount: i.netAmount,
});

export const getBillingSummary = async (
  env: Env,
  login: string,
  period: { year: number; month: number },
): Promise<BillingUsageSummary> => {
  const params = new URLSearchParams({
    year: String(period.year),
    month: String(period.month),
  });
  const res = await gh<BillingUsageSummary>(
    env,
    `/users/${encodeURIComponent(login)}/settings/billing/usage/summary?${params}`,
  );
  return {
    timePeriod: res.timePeriod,
    usageItems: (res.usageItems ?? []).map(pickItem),
  };
};

export const getPremiumRequests = async (
  env: Env,
  login: string,
  period: { year: number; month: number },
): Promise<PremiumRequestUsage> => {
  const params = new URLSearchParams({
    year: String(period.year),
    month: String(period.month),
  });
  const res = await gh<PremiumRequestUsage>(
    env,
    `/users/${encodeURIComponent(login)}/settings/billing/ai_credit/usage?${params}`,
  );
  return {
    timePeriod: res.timePeriod,
    usageItems: (res.usageItems ?? []).map(
      (i): PremiumRequestItem => ({ ...pickItem(i), model: i.model }),
    ),
  };
};

// ── Actions 実行履歴 ──

interface RawRepo {
  full_name: string;
  archived: boolean;
  disabled?: boolean;
}

interface RawRun {
  id: number;
  name: string | null;
  display_title: string;
  head_branch: string | null;
  event: string;
  status: string;
  conclusion: string | null;
  run_number: number;
  created_at: string;
  run_started_at?: string | null;
  updated_at: string;
  html_url: string;
}

const RUNS_REPO_LIMIT = 15;
const RUNS_PER_REPO = 5;
const RUNS_LIMIT = 10;
const RUNS_CACHE_SEC = 60;

const toRun = (repo: string, r: RawRun): WorkflowRun => ({
  id: r.id,
  repo,
  workflowName: r.name ?? 'workflow',
  title: r.display_title,
  branch: r.head_branch,
  event: r.event,
  status: r.status,
  conclusion: r.conclusion,
  runNumber: r.run_number,
  createdAt: r.created_at,
  startedAt: r.run_started_at ?? null,
  updatedAt: r.updated_at,
  htmlUrl: r.html_url,
});

const fetchRecentRuns = async (env: Env): Promise<WorkflowRun[]> => {
  // 最近 push された自分のリポジトリ上位から集める（API に「全リポジトリの実行履歴」はない）
  const repos = (
    await gh<RawRepo[]>(
      env,
      `/user/repos?affiliation=owner&sort=pushed&direction=desc&per_page=${RUNS_REPO_LIMIT + 5}`,
    )
  )
    .filter((r) => !r.archived && !r.disabled)
    .slice(0, RUNS_REPO_LIMIT);

  const results = await Promise.allSettled(
    repos.map(async (repo) => {
      const res = await gh<{ workflow_runs: RawRun[] }>(
        env,
        `/repos/${repo.full_name}/actions/runs?per_page=${RUNS_PER_REPO}&exclude_pull_requests=true`,
      );
      return res.workflow_runs.map((r) => toRun(repo.full_name, r));
    }),
  );

  const failures = results.filter(
    (r): r is PromiseRejectedResult => r.status === 'rejected',
  );
  // 全リポジトリで失敗したら権限不足とみなしてエラーにする（一部だけなら無視）
  if (repos.length > 0 && failures.length === repos.length) {
    const reason = failures[0].reason;
    throw reason instanceof GithubError && reason.status === 403
      ? new GithubError(
          403,
          'Actions の履歴を取得できません。GITHUB_TOKEN に Actions (read) 権限が必要です',
        )
      : reason;
  }

  return results
    .flatMap((r) => (r.status === 'fulfilled' ? r.value : []))
    .sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    )
    .slice(0, RUNS_LIMIT);
};

// workers.dev では Cache API が効かないので isolate 内のメモリにも持つ
let runsMemo: { runs: WorkflowRun[]; at: number } | null = null;

/** 十数回の API 呼び出しになるので1分キャッシュ（メモリ → エッジキャッシュ → GitHub） */
export const listRecentRuns = async (env: Env): Promise<WorkflowRun[]> => {
  if (runsMemo && Date.now() - runsMemo.at < RUNS_CACHE_SEC * 1000) {
    return runsMemo.runs;
  }
  const cache = typeof caches !== 'undefined' ? caches.default : null;
  const key = new Request('https://codespacedash.internal/actions-runs');
  const hit = cache ? await cache.match(key) : undefined;
  if (hit) {
    const runs = await hit.json<WorkflowRun[]>();
    runsMemo = { runs, at: Date.now() };
    return runs;
  }
  const runs = await fetchRecentRuns(env);
  runsMemo = { runs, at: Date.now() };
  await cache?.put(
    key,
    new Response(JSON.stringify(runs), {
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': `max-age=${RUNS_CACHE_SEC}`,
      },
    }),
  );
  return runs;
};
