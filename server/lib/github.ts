import type {
  BillingUsageItem,
  BillingUsageSummary,
  Codespace,
  GithubUser,
  PremiumRequestItem,
  PremiumRequestUsage,
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
