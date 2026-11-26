import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fakeCache, fakeEnv, json } from '../testing/fakeEnv';

// getUser・listRecentRuns はモジュール内にキャッシュを持つので、テストごとに読み直す
const load = () => import('./github');

const NOW = new Date('2026-11-27T05:00:00Z');
const env = fakeEnv();
const fetchMock = vi.fn<typeof fetch>();

type Route = (url: URL, init?: RequestInit) => Response;
const routes = (r: Record<string, Route>) => {
  fetchMock.mockImplementation(async (input, init) => {
    const url = new URL(String(input));
    const key = Object.keys(r)
      .sort((a, b) => b.length - a.length)
      .find((k) => url.pathname.startsWith(k));
    if (!key) {
      throw new Error(`unexpected ${url.pathname}`);
    }
    return r[key](url, init);
  });
};

beforeEach(() => {
  vi.resetModules();
  vi.useFakeTimers({ now: NOW, toFake: ['Date'] });
  fetchMock.mockReset();
  vi.stubGlobal('fetch', fetchMock);
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('GitHub API の呼び出し', () => {
  it('トークンと必要なヘッダーを付ける', async () => {
    routes({ '/user': () => json({ login: 'me' }) });
    const { getUser } = await load();
    await getUser(env);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('https://api.github.com/user');
    expect(init?.headers).toEqual({
      Authorization: 'Bearer ghp_test',
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      'User-Agent': 'codespacedash',
    });
  });

  it('トークンがなければ呼ばずにエラー', async () => {
    const { getUser, GithubError } = await load();
    const e = await getUser(fakeEnv({ GITHUB_TOKEN: '' })).catch(
      (e: unknown) => e,
    );
    expect(e).toBeInstanceOf(GithubError);
    expect(e).toMatchObject({ status: 500 });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('エラー応答は GitHub の message を添える', async () => {
    routes({ '/user': () => json({ message: 'Bad credentials' }, 401) });
    const { getUser } = await load();
    await expect(getUser(env)).rejects.toMatchObject({
      status: 401,
      message: 'GitHub API 401: Bad credentials',
    });
  });

  it('message がない・JSON でないエラー応答はステータスだけ', async () => {
    const { getUser } = await load();
    routes({ '/user': () => json({}, 500) });
    await expect(getUser(env)).rejects.toThrow(/^GitHub API 500$/);
    routes({ '/user': () => new Response('<html>', { status: 502 }) });
    await expect(getUser(env)).rejects.toThrow(/^GitHub API 502$/);
  });
});

describe('getUser', () => {
  it('必要なフィールドだけにして、プラン名を取り出す', async () => {
    routes({
      '/user': () =>
        json({
          login: 'me',
          name: 'Me',
          avatar_url: 'a',
          html_url: 'h',
          email: 'secret@example.com',
          plan: { name: 'pro', space: 1 },
        }),
    });
    const { getUser } = await load();
    expect(await getUser(env)).toEqual({
      login: 'me',
      name: 'Me',
      avatar_url: 'a',
      html_url: 'h',
      plan: 'pro',
    });
  });

  it('プランが返らなければ null', async () => {
    routes({ '/user': () => json({ login: 'me', plan: {} }) });
    const { getUser } = await load();
    expect((await getUser(env)).plan).toBeNull();
  });

  it('10分間はキャッシュを使う', async () => {
    routes({ '/user': () => json({ login: 'me' }) });
    const { getUser } = await load();
    await getUser(env);
    vi.setSystemTime(NOW.getTime() + 10 * 60_000 - 1);
    await getUser(env);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    vi.setSystemTime(NOW.getTime() + 10 * 60_000);
    await getUser(env);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});

describe('listCodespaces', () => {
  const raw = (id: number, p: Record<string, unknown> = {}) => ({
    id,
    name: `cs-${id}`,
    display_name: `CS ${id}`,
    state: 'Available',
    machine: {
      name: 'basicLinux32gb',
      display_name: '2 cores',
      cpus: 2,
      memory_in_bytes: 8,
      storage_in_bytes: 32,
      operating_system: 'linux',
    },
    repository: { full_name: 'me/repo', html_url: 'https://x', id: 9 },
    created_at: 'c',
    last_used_at: 'l',
    location: 'EastUs',
    retention_expires_at: 'r',
    idle_timeout_minutes: 30,
    web_url: 'w',
    owner: { login: 'me' },
    ...p,
  });

  it('必要なフィールドだけにして、未 push の変更をまとめる', async () => {
    routes({
      '/user/codespaces': () =>
        json({
          total_count: 4,
          codespaces: [
            raw(1, {
              git_status: {
                has_uncommitted_changes: true,
                has_unpushed_changes: false,
              },
            }),
            raw(2, { git_status: { has_unpushed_changes: true } }),
            raw(3, {
              git_status: {},
              machine: null,
              retention_expires_at: undefined,
              idle_timeout_minutes: undefined,
            }),
            raw(4),
          ],
        }),
    });
    const { listCodespaces } = await load();
    const cs = await listCodespaces(env);
    expect(cs[0]).toEqual({
      id: 1,
      name: 'cs-1',
      display_name: 'CS 1',
      state: 'Available',
      machine: {
        name: 'basicLinux32gb',
        display_name: '2 cores',
        cpus: 2,
        memory_in_bytes: 8,
        storage_in_bytes: 32,
      },
      repository: { full_name: 'me/repo', html_url: 'https://x' },
      created_at: 'c',
      last_used_at: 'l',
      location: 'EastUs',
      retention_expires_at: 'r',
      idle_timeout_minutes: 30,
      web_url: 'w',
      has_unpushed_changes: true,
    });
    expect(cs.map((c) => c.has_unpushed_changes)).toEqual([
      true,
      true,
      false,
      false,
    ]);
    expect(cs[2]).toMatchObject({
      machine: null,
      retention_expires_at: null,
      idle_timeout_minutes: null,
    });
  });

  it('total_count に届くまでページをたどる', async () => {
    const pages: number[] = [];
    routes({
      '/user/codespaces': (url) => {
        const page = Number(url.searchParams.get('page'));
        pages.push(page);
        return json({
          total_count: 150,
          codespaces: Array.from({ length: page === 1 ? 100 : 50 }, (_, i) =>
            raw(page * 1000 + i),
          ),
        });
      },
    });
    const { listCodespaces } = await load();
    expect(await listCodespaces(env)).toHaveLength(150);
    expect(pages).toEqual([1, 2]);
  });

  it('空のページが来たら total_count に届かなくてもやめる', async () => {
    routes({
      '/user/codespaces': (url) =>
        json({
          total_count: 999,
          codespaces: url.searchParams.get('page') === '1' ? [raw(1)] : [],
        }),
    });
    const { listCodespaces } = await load();
    expect(await listCodespaces(env)).toHaveLength(1);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('多くても10ページで打ち切る', async () => {
    let n = 0;
    routes({
      '/user/codespaces': () =>
        json({ total_count: 99_999, codespaces: [raw(n++)] }),
    });
    const { listCodespaces } = await load();
    expect(await listCodespaces(env)).toHaveLength(10);
  });
});

describe('stopCodespace', () => {
  it('POST で停止する（204 は null）', async () => {
    routes({ '/user/codespaces/': () => new Response(null, { status: 204 }) });
    const { stopCodespace } = await load();
    await stopCodespace(env, 'my-cs-123');
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('https://api.github.com/user/codespaces/my-cs-123/stop');
    expect(init?.method).toBe('POST');
  });

  it.each(['', '../repos', 'a/b', 'a b', 'x'.repeat(101)])(
    '不正な名前 "%s" は呼ばずに 400',
    async (name) => {
      const { stopCodespace } = await load();
      await expect(stopCodespace(env, name)).rejects.toMatchObject({
        status: 400,
      });
      expect(fetchMock).not.toHaveBeenCalled();
    },
  );
});

describe('currentPeriod', () => {
  it('既定は日本時間の今月', async () => {
    // UTC では 11月30日 16:00 だが、日本時間では 12月1日
    vi.setSystemTime(new Date('2026-11-30T16:00:00Z'));
    const { currentPeriod } = await load();
    expect(currentPeriod()).toEqual({ year: 2026, month: 12 });
    expect(currentPeriod('UTC')).toEqual({ year: 2026, month: 11 });
  });
});

describe('getBillingSummary / getPremiumRequests', () => {
  const usage = {
    product: 'codespaces',
    sku: 's',
    unitType: 'hours',
    pricePerUnit: 1,
    grossQuantity: 2,
    grossAmount: 3,
    discountQuantity: 4,
    discountAmount: 5,
    netQuantity: 6,
    netAmount: 7,
    repositoryName: 'secret',
  };
  const { repositoryName: _, ...picked } = usage;

  it('期間を付けて呼び、項目を必要なフィールドだけにする', async () => {
    routes({
      '/users/': () =>
        json({ timePeriod: { year: 2026, month: 11 }, usageItems: [usage] }),
    });
    const { getBillingSummary } = await load();
    expect(
      await getBillingSummary(env, 'a b', { year: 2026, month: 11 }),
    ).toEqual({
      timePeriod: { year: 2026, month: 11 },
      usageItems: [picked],
    });
    expect(fetchMock.mock.calls[0][0]).toBe(
      'https://api.github.com/users/a%20b/settings/billing/usage/summary?year=2026&month=11',
    );
  });

  it('Copilot はモデル名も残す', async () => {
    routes({
      '/users/': () =>
        json({
          timePeriod: { year: 2026 },
          usageItems: [{ ...usage, model: 'gpt-5' }],
        }),
    });
    const { getPremiumRequests } = await load();
    expect(
      await getPremiumRequests(env, 'me', { year: 2026, month: 11 }),
    ).toEqual({
      timePeriod: { year: 2026 },
      usageItems: [{ ...picked, model: 'gpt-5' }],
    });
    expect(String(fetchMock.mock.calls[0][0])).toContain(
      '/users/me/settings/billing/ai_credit/usage?year=2026&month=11',
    );
  });

  it('usageItems がなければ空', async () => {
    routes({ '/users/': () => json({ timePeriod: { year: 2026 } }) });
    const { getBillingSummary, getPremiumRequests } = await load();
    const p = { year: 2026, month: 11 };
    expect((await getBillingSummary(env, 'me', p)).usageItems).toEqual([]);
    expect((await getPremiumRequests(env, 'me', p)).usageItems).toEqual([]);
  });
});

describe('listRecentRuns', () => {
  const run = (
    id: number,
    createdAt: string,
    p: Record<string, unknown> = {},
  ) => ({
    id,
    name: 'CI',
    display_title: `run ${id}`,
    head_branch: 'main',
    event: 'push',
    status: 'completed',
    conclusion: 'success',
    run_number: id,
    created_at: createdAt,
    run_started_at: createdAt,
    updated_at: createdAt,
    html_url: `https://github.com/r/${id}`,
    ...p,
  });

  const repos = () =>
    json([
      { full_name: 'me/a', archived: false },
      { full_name: 'me/old', archived: true },
      { full_name: 'me/off', archived: false, disabled: true },
      { full_name: 'me/b', archived: false },
    ]);

  it('アーカイブ・無効のリポジトリを除き、新しい順に10件にまとめる', async () => {
    routes({
      '/user/repos': repos,
      '/repos/me/a/': () =>
        json({
          workflow_runs: Array.from({ length: 6 }, (_, i) =>
            run(i, `2026-11-2${i}T00:00:00Z`),
          ),
        }),
      '/repos/me/b/': () =>
        json({
          workflow_runs: [
            run(100, '2026-11-26T12:00:00Z', {
              name: null,
              run_started_at: undefined,
              conclusion: null,
            }),
            ...Array.from({ length: 5 }, (_, i) =>
              run(200 + i, `2026-11-1${i}T00:00:00Z`),
            ),
          ],
        }),
    });
    const { listRecentRuns } = await load();
    const runs = await listRecentRuns(env);

    expect(runs).toHaveLength(10);
    expect(runs.map((r) => r.id).slice(0, 3)).toEqual([100, 5, 4]);
    expect(runs[0]).toEqual({
      id: 100,
      repo: 'me/b',
      workflowName: 'workflow',
      title: 'run 100',
      branch: 'main',
      event: 'push',
      status: 'completed',
      conclusion: null,
      runNumber: 100,
      createdAt: '2026-11-26T12:00:00Z',
      startedAt: null,
      updatedAt: '2026-11-26T12:00:00Z',
      htmlUrl: 'https://github.com/r/100',
    });
    expect(runs[1]).toMatchObject({ workflowName: 'CI', repo: 'me/a' });
    const called = fetchMock.mock.calls.map(
      ([u]) => new URL(String(u)).pathname,
    );
    expect(called).not.toContain('/repos/me/old/actions/runs');
    expect(called).not.toContain('/repos/me/off/actions/runs');
  });

  it('一部のリポジトリが失敗しても残りを返す', async () => {
    routes({
      '/user/repos': repos,
      '/repos/me/a/': () => json({}, 404),
      '/repos/me/b/': () =>
        json({ workflow_runs: [run(1, '2026-11-26T00:00:00Z')] }),
    });
    const { listRecentRuns } = await load();
    expect((await listRecentRuns(env)).map((r) => r.id)).toEqual([1]);
  });

  it('全リポジトリで 403 なら Actions 権限が足りないと案内する', async () => {
    routes({ '/user/repos': repos, '/repos/': () => json({}, 403) });
    const { listRecentRuns } = await load();
    await expect(listRecentRuns(env)).rejects.toMatchObject({
      status: 403,
      message: expect.stringContaining('Actions (read)'),
    });
  });

  it('全リポジトリで 403 以外の失敗なら、そのエラーを投げる', async () => {
    routes({ '/user/repos': repos, '/repos/': () => json({}, 500) });
    const { listRecentRuns } = await load();
    await expect(listRecentRuns(env)).rejects.toMatchObject({ status: 500 });
  });

  it('GitHub 以外の例外もそのまま投げる', async () => {
    routes({
      '/user/repos': repos,
      '/repos/': () => {
        throw new TypeError('network');
      },
    });
    const { listRecentRuns } = await load();
    await expect(listRecentRuns(env)).rejects.toThrow('network');
  });

  it('リポジトリがなければ空', async () => {
    routes({ '/user/repos': () => json([]) });
    const { listRecentRuns } = await load();
    expect(await listRecentRuns(env)).toEqual([]);
  });

  it('1分間はメモリのキャッシュを返す', async () => {
    routes({ '/user/repos': () => json([]) });
    const { listRecentRuns } = await load();
    const a = await listRecentRuns(env);
    expect(await listRecentRuns(env)).toBe(a);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    vi.setSystemTime(NOW.getTime() + 60_000);
    await listRecentRuns(env);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('エッジキャッシュがあれば保存し、別の isolate からも使う', async () => {
    const cache = fakeCache();
    vi.stubGlobal('caches', { default: cache });
    routes({
      '/user/repos': () => json([{ full_name: 'me/a', archived: false }]),
      '/repos/': () =>
        json({ workflow_runs: [run(1, '2026-11-26T00:00:00Z')] }),
    });
    const first = await (await load()).listRecentRuns(env);
    expect(
      cache.store
        .get('https://codespacedash.internal/actions-runs')
        ?.headers.get('Cache-Control'),
    ).toBe('max-age=60');

    vi.resetModules();
    fetchMock.mockClear();
    const { listRecentRuns } = await load();
    expect(await listRecentRuns(env)).toEqual(first);
    cache.store.clear();
    expect(await listRecentRuns(env)).toEqual(first);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
