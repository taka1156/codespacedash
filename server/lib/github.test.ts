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

describe('トークンの期限', () => {
  const withExpiration = (value: string | null) =>
    routes({
      '/user': () => {
        const res = json({ login: 'me' });
        if (value !== null) {
          res.headers.set('GitHub-Authentication-Token-Expiration', value);
        }
        return res;
      },
    });

  it('/user の応答ヘッダーから読み、追加のリクエストはしない', async () => {
    withExpiration('2026-12-03 00:00:00 UTC');
    const { getUser, getGithubToken } = await load();
    await getUser(env);
    expect(await getGithubToken(env)).toEqual({
      expiresAt: '2026-12-03T00:00:00.000Z',
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('ヘッダーがなければ無期限（null）', async () => {
    withExpiration(null);
    const { getGithubToken } = await load();
    expect(await getGithubToken(env)).toEqual({ expiresAt: null });
  });

  it.each([
    ['2026-12-03 09:00:00 +0900', '2026-12-03T00:00:00.000Z'],
    ['2026-12-03 09:00:00 +09:00', '2026-12-03T00:00:00.000Z'],
    [' 2026-12-03 00:00:00 UTC ', '2026-12-03T00:00:00.000Z'],
  ])('時差付きの %s も読める', async (raw, iso) => {
    const { parseTokenExpiration } = await load();
    expect(parseTokenExpiration(raw)).toBe(iso);
  });

  it.each(['tomorrow', '2026-13-45 00:00:00 UTC'])(
    '読めない値（%s）はエラーにする（無期限と取り違えない）',
    async (raw) => {
      const { parseTokenExpiration, GithubError } = await load();
      expect(() => parseTokenExpiration(raw)).toThrow(GithubError);
      expect(() => parseTokenExpiration(raw)).toThrow(raw);
    },
  );
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

describe('getBillingSummary：公開リポジトリの Actions を除く', () => {
  const p = { year: 2026, month: 11 };
  const item = (sku: string, p: Record<string, unknown> = {}) => ({
    product: 'actions',
    sku,
    unitType: 'minutes',
    pricePerUnit: 0.006,
    grossQuantity: 999,
    grossAmount: 999,
    discountQuantity: 0,
    discountAmount: 0,
    netQuantity: 0,
    netAmount: 0,
    ...p,
  });
  const codespaces = item('cs', { product: 'codespaces', unitType: 'hours' });
  const line = (p: Record<string, unknown>) => ({
    product: 'Actions',
    sku: 'actions_linux',
    unitType: 'minutes',
    pricePerUnit: 0.006,
    quantity: 100,
    grossAmount: 0.6,
    discountAmount: 0.6,
    netAmount: 0,
    repositoryName: 'me/private-app',
    ...p,
  });
  const summary = () =>
    json({
      timePeriod: p,
      usageItems: [item('actions_linux'), codespaces],
    });

  it('明細から公開リポジトリの無料分を除いて集計し直す', async () => {
    const publicPage1 = Array.from({ length: 100 }, (_, i) => ({
      full_name: `me/pub-${i}`,
    }));
    routes({
      '/users/me/settings/billing/usage/summary': summary,
      '/users/me/settings/billing/usage': () =>
        json({
          usageItems: [
            // 公開リポジトリの無料分（大文字小文字は区別しない）→ 除く
            line({ repositoryName: 'Me/Pub-0', quantity: 5000 }),
            line({ repositoryName: 'me/pub-last', quantity: 5000 }),
            // private の分は合算する
            line({ quantity: 100 }),
            line({
              quantity: 50,
              grossAmount: 0.3,
              discountAmount: 0.15,
              netAmount: 0.15,
            }),
            // リポジトリ名がない・金額ゼロの明細も private 扱いで数える
            line({
              repositoryName: undefined,
              quantity: 1,
              grossAmount: 0,
              discountAmount: 0,
            }),
            // 公開リポジトリでも課金された分（larger runner）→ 残す
            line({
              sku: 'actions_linux_4_core',
              repositoryName: 'me/pub-0',
              quantity: 10,
              grossAmount: 0.16,
              discountAmount: 0,
              netAmount: 0.16,
            }),
            // Actions の実行時間以外は無視
            line({ product: 'codespaces', unitType: 'hours' }),
            line({ unitType: 'gigabyte-hours' }),
          ],
        }),
      '/users/me/repos': (url) =>
        json(
          url.searchParams.get('page') === '1'
            ? publicPage1
            : [{ full_name: 'me/pub-last' }],
        ),
    });
    const { getBillingSummary } = await load();
    const res = await getBillingSummary(env, 'me', p);

    expect(res.usageItems).toEqual([
      codespaces,
      {
        product: 'Actions',
        sku: 'actions_linux',
        unitType: 'minutes',
        pricePerUnit: 0.006,
        grossQuantity: 151,
        grossAmount: expect.closeTo(0.9),
        discountQuantity: 125,
        discountAmount: expect.closeTo(0.75),
        netQuantity: 26,
        netAmount: expect.closeTo(0.15),
      },
      {
        product: 'Actions',
        sku: 'actions_linux_4_core',
        unitType: 'minutes',
        pricePerUnit: 0.006,
        grossQuantity: 10,
        grossAmount: 0.16,
        discountQuantity: 0,
        discountAmount: 0,
        netQuantity: 10,
        netAmount: 0.16,
      },
    ]);
    const called = fetchMock.mock.calls.map(([u]) => String(u));
    expect(called).toContain(
      'https://api.github.com/users/me/settings/billing/usage?year=2026&month=11',
    );
    expect(called).toContain(
      'https://api.github.com/users/me/repos?type=owner&per_page=100&page=2',
    );
  });

  it('公開リポジトリは10ページで打ち切る', async () => {
    routes({
      '/users/me/settings/billing/usage/summary': summary,
      '/users/me/settings/billing/usage': () => json({ usageItems: [] }),
      '/users/me/repos': () =>
        json(Array.from({ length: 100 }, (_, i) => ({ full_name: `r${i}` }))),
    });
    const { getBillingSummary } = await load();
    await getBillingSummary(env, 'me', p);
    expect(
      fetchMock.mock.calls.filter(([u]) => String(u).includes('/repos?')),
    ).toHaveLength(10);
  });

  it('明細に usageItems がなければ Actions の実行時間はなし', async () => {
    routes({
      '/users/me/settings/billing/usage/summary': summary,
      '/users/me/settings/billing/usage': () => json({}),
      '/users/me/repos': () => json([]),
    });
    const { getBillingSummary } = await load();
    expect((await getBillingSummary(env, 'me', p)).usageItems).toEqual([
      codespaces,
    ]);
  });

  it('明細が取れなければ summary のまま返す', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    routes({
      '/users/me/settings/billing/usage/summary': summary,
      '/users/me/settings/billing/usage': () => json({}, 403),
      '/users/me/repos': () => json([]),
    });
    const { getBillingSummary } = await load();
    expect((await getBillingSummary(env, 'me', p)).usageItems).toEqual([
      item('actions_linux'),
      codespaces,
    ]);
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
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

  it('private / public それぞれ新しい順に10件ずつ残す', async () => {
    routes({
      '/user/repos': () =>
        json([
          { full_name: 'me/pub', private: false, archived: false },
          { full_name: 'me/priv', private: true, archived: false },
        ]),
      '/repos/me/pub/': () =>
        json({
          workflow_runs: Array.from({ length: 15 }, (_, i) =>
            run(i, `2026-11-${String(10 + i).padStart(2, '0')}T00:00:00Z`),
          ),
        }),
      '/repos/me/priv/': () =>
        json({
          workflow_runs: [
            run(100, '2026-11-01T00:00:00Z'),
            run(101, '2026-11-02T00:00:00Z'),
          ],
        }),
    });
    const { listRecentRuns } = await load();
    const runs = await listRecentRuns(env);

    const pub = runs.filter((r) => !r.private);
    const priv = runs.filter((r) => r.private);
    expect(pub.map((r) => r.id)).toEqual([14, 13, 12, 11, 10, 9, 8, 7, 6, 5]);
    expect(priv.map((r) => r.id)).toEqual([101, 100]);
    expect(priv[0]).toMatchObject({ repo: 'me/priv', private: true });
    // 全体も新しい順のまま
    expect(runs.map((r) => r.id).slice(-2)).toEqual([101, 100]);
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
