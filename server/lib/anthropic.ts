import type {
  ClaudeDailyUsage,
  ClaudeModelUsage,
  ClaudeTokens,
  ClaudeUsage,
} from '../../shared/types';
import type { Env } from '../env';

export class AnthropicError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

export const claudeConfigured = (env: Env) => Boolean(env.ANTHROPIC_ADMIN_KEY);

const MAX_PAGES = 5;

const admin = async <T>(
  env: Env,
  path: string,
  params: URLSearchParams,
): Promise<T> => {
  if (!env.ANTHROPIC_ADMIN_KEY) {
    throw new AnthropicError(500, 'ANTHROPIC_ADMIN_KEY が設定されていません');
  }
  const res = await fetch(`https://api.anthropic.com${path}?${params}`, {
    headers: {
      'x-api-key': env.ANTHROPIC_ADMIN_KEY,
      'anthropic-version': '2023-06-01',
      'User-Agent': 'codespacedash',
    },
  });
  if (!res.ok) {
    let message = `Anthropic API ${res.status}`;
    try {
      const body = (await res.json()) as { error?: { message?: string } };
      if (body.error?.message) {
        message += `: ${body.error.message}`;
      }
    } catch {}
    if (res.status === 401 || res.status === 403) {
      message +=
        '（ANTHROPIC_ADMIN_KEY に Admin API キー sk-ant-admin01-... を設定してください）';
    }
    throw new AnthropicError(res.status, message);
  }
  return (await res.json()) as T;
};

interface Page<R> {
  data: { starting_at: string; ending_at: string; results: R[] }[];
  has_more: boolean;
  next_page: string | null;
}

const fetchAllBuckets = async <R>(
  env: Env,
  path: string,
  params: URLSearchParams,
) => {
  const buckets: Page<R>['data'] = [];
  let page: string | null = null;
  for (let i = 0; i < MAX_PAGES; i++) {
    const p = new URLSearchParams(params);
    if (page) {
      p.set('page', page);
    }
    const res: Page<R> = await admin<Page<R>>(env, path, p);
    buckets.push(...res.data);
    if (!res.has_more || !res.next_page) {
      break;
    }
    page = res.next_page;
  }
  return buckets;
};

interface RawUsage {
  model: string | null;
  uncached_input_tokens?: number;
  cache_read_input_tokens?: number;
  output_tokens?: number;
  cache_creation?: {
    ephemeral_1h_input_tokens?: number;
    ephemeral_5m_input_tokens?: number;
  } | null;
  server_tool_use?: { web_search_requests?: number } | null;
}

interface RawCost {
  amount: string;
  currency: string;
  model?: string | null;
}

const zero = (): ClaudeTokens => ({
  input: 0,
  cacheWrite: 0,
  cacheRead: 0,
  output: 0,
});

const addTokens = (t: ClaudeTokens, r: RawUsage) => {
  t.input += r.uncached_input_tokens ?? 0;
  t.cacheRead += r.cache_read_input_tokens ?? 0;
  t.cacheWrite +=
    (r.cache_creation?.ephemeral_5m_input_tokens ?? 0) +
    (r.cache_creation?.ephemeral_1h_input_tokens ?? 0);
  t.output += r.output_tokens ?? 0;
};

const pad = (n: number) => String(n).padStart(2, '0');

const monthRange = (period: { year: number; month: number }) => {
  const start = new Date(Date.UTC(period.year, period.month - 1, 1));
  const nextMonth = new Date(Date.UTC(period.year, period.month, 1));
  const now = new Date();
  const tomorrow = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1),
  );
  const end = tomorrow < nextMonth ? tomorrow : nextMonth;
  if (end <= start) {
    return null;
  }
  return {
    starting_at: start.toISOString(),
    ending_at: end.toISOString(),
  };
};

const baseModel = (name: string) => name.replace(/-\d{8}$/, '');

const matchModel = (models: Map<string, ClaudeModelUsage>, name: string) => {
  const exact = models.get(name);
  if (exact) {
    return exact;
  }
  const target = baseModel(name);
  for (const [k, v] of models) {
    if (baseModel(k) === target) {
      return v;
    }
  }
  return undefined;
};

const fetchClaudeUsage = async (
  env: Env,
  period: { year: number; month: number },
): Promise<ClaudeUsage> => {
  const range = monthRange(period);
  if (!range) {
    return { timePeriod: period, models: [], daily: [], totalCostUsd: 0 };
  }

  const usageParams = new URLSearchParams({
    ...range,
    bucket_width: '1d',
    limit: '31',
  });
  usageParams.append('group_by[]', 'model');

  const costParams = new URLSearchParams({
    ...range,
    bucket_width: '1d',
    limit: '31',
  });
  costParams.append('group_by[]', 'description');

  const [usageBuckets, costResult] = await Promise.all([
    fetchAllBuckets<RawUsage>(
      env,
      '/v1/organizations/usage_report/messages',
      usageParams,
    ),
    fetchAllBuckets<RawCost>(env, '/v1/organizations/cost_report', costParams)
      .then((b) => ({ ok: true as const, buckets: b }))
      .catch((e: unknown) => {
        console.warn('cost_report failed', e);
        return { ok: false as const };
      }),
  ]);

  const models = new Map<string, ClaudeModelUsage>();
  const daily = new Map<string, ClaudeDailyUsage>();
  const dayOf = (iso: string) => iso.slice(0, 10);
  const getDay = (date: string) => {
    let d = daily.get(date);
    if (!d) {
      d = { date, ...zero(), costUsd: costResult.ok ? 0 : null };
      daily.set(date, d);
    }
    return d;
  };

  for (const bucket of usageBuckets) {
    const day = getDay(dayOf(bucket.starting_at));
    for (const r of bucket.results) {
      const name = r.model ?? 'unknown';
      let m = models.get(name);
      if (!m) {
        m = {
          model: name,
          ...zero(),
          webSearchRequests: 0,
          costUsd: costResult.ok ? 0 : null,
        };
        models.set(name, m);
      }
      addTokens(m, r);
      m.webSearchRequests += r.server_tool_use?.web_search_requests ?? 0;
      addTokens(day, r);
    }
  }

  let totalCostUsd: number | null = null;
  if (costResult.ok) {
    totalCostUsd = 0;
    for (const bucket of costResult.buckets) {
      const day = getDay(dayOf(bucket.starting_at));
      for (const r of bucket.results) {
        const usd = Number(r.amount) / 100;
        if (!Number.isFinite(usd)) {
          continue;
        }
        totalCostUsd += usd;
        day.costUsd = (day.costUsd ?? 0) + usd;
        if (r.model) {
          const m = matchModel(models, r.model);
          if (m) {
            m.costUsd = (m.costUsd ?? 0) + usd;
          } else {
            models.set(r.model, {
              model: r.model,
              ...zero(),
              webSearchRequests: 0,
              costUsd: usd,
            });
          }
        }
      }
    }
  }

  const totalTokens = (t: ClaudeTokens) =>
    t.input + t.cacheWrite + t.cacheRead + t.output;

  return {
    timePeriod: period,
    models: [...models.values()]
      .filter((m) => totalTokens(m) > 0 || (m.costUsd ?? 0) > 0)
      .sort((a, b) => totalTokens(b) - totalTokens(a)),
    daily: [...daily.values()].sort((a, b) => a.date.localeCompare(b.date)),
    totalCostUsd,
  };
};

const CACHE_MS = 5 * 60_000;
let memo: { key: string; usage: ClaudeUsage; at: number } | null = null;

export const getClaudeUsage = async (
  env: Env,
  period: { year: number; month: number },
): Promise<ClaudeUsage> => {
  const key = `${period.year}-${pad(period.month)}`;
  if (memo && memo.key === key && Date.now() - memo.at < CACHE_MS) {
    return memo.usage;
  }
  const usage = await fetchClaudeUsage(env, period);
  memo = { key, usage, at: Date.now() };
  return usage;
};
