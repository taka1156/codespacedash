import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fakeCache, fakeEnv, json } from '../testing/fakeEnv';

// getWorkersBuilds はモジュール内に1分キャッシュを持つので、テストごとに読み直す
const load = () => import('./cloudflare');

const NOW = new Date('2026-11-27T05:00:00Z');
const env = fakeEnv({
  CLOUDFLARE_API_TOKEN: 'cf_token',
  CLOUDFLARE_ACCOUNT_ID: 'acc 1',
  TIMEZONE: 'UTC',
});

const ok = (result: unknown, extra: Record<string, unknown> = {}) =>
  json({ success: true, errors: [], result, ...extra });

const rawBuild = (
  id: string,
  createdOn: string,
  p: Record<string, unknown> = {},
) => ({
  build_uuid: id,
  status: 'stopped',
  build_outcome: 'success',
  created_on: createdOn,
  initializing_on: createdOn,
  stopped_on: new Date(new Date(createdOn).getTime() + 90_000).toISOString(),
  build_trigger_metadata: {
    branch: 'main',
    commit_hash: 'abc',
    commit_message: 'msg',
    build_trigger_source: 'push',
    repo_name: 'repo',
  },
  ...p,
});

type Route = (url: URL) => Response | Promise<Response>;

/** パスの前方一致で応答を返す疑似 Cloudflare API */
const fetchMock = vi.fn<typeof fetch>();
const routes = (r: Record<string, Route>) => {
  fetchMock.mockImplementation(async (input) => {
    const url = new URL(String(input));
    const path = url.pathname.replace('/client/v4/accounts/acc%201', '');
    const key = Object.keys(r)
      .sort((a, b) => b.length - a.length)
      .find((k) => path.startsWith(k));
    if (!key) {
      throw new Error(`unexpected ${path}`);
    }
    return r[key](url);
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

describe('workersConfigured', () => {
  it('トークンとアカウント ID の両方が必要', async () => {
    const { workersConfigured } = await load();
    expect(workersConfigured(env)).toBe(true);
    expect(workersConfigured(fakeEnv({ CLOUDFLARE_API_TOKEN: 'x' }))).toBe(
      false,
    );
    expect(workersConfigured(fakeEnv({ CLOUDFLARE_ACCOUNT_ID: 'x' }))).toBe(
      false,
    );
  });
});

describe('getWorkersBuilds', () => {
  const basic = (): Record<string, Route> => ({
    '/workers/scripts': () =>
      ok([
        { id: 'site', tag: 'tag-site' },
        { id: 'api', tag: 'tag-api' },
        { id: 'nogit', tag: 'tag-nogit' },
        // tag がない Worker は対象外
        { id: 'broken', tag: '' },
      ]),
    '/builds/account/limits': () =>
      ok({
        build_minutes_refresh_on: '2026-12-10T00:00:00Z',
        has_reached_build_minutes_limit: true,
      }),
    '/builds/builds/latest': () =>
      ok({
        builds: {
          'tag-site': { trigger: { external_script_id: 'tag-site' } },
          // trigger がなければキーの tag を使う
          'tag-api': {},
        },
      }),
    '/builds/workers/tag-site/builds': () =>
      ok([rawBuild('s1', '2026-11-26T00:00:00Z')], {
        result_info: { total_pages: 1 },
      }),
    '/builds/workers/tag-api/builds': () =>
      ok([
        rawBuild('a1', '2026-11-27T00:00:00Z', {
          status: 'running',
          build_outcome: undefined,
          initializing_on: null,
          running_on: '2026-11-27T00:01:00Z',
          stopped_on: undefined,
          build_trigger_metadata: null,
        }),
        rawBuild('a2', '2026-11-25T00:00:00Z', {
          initializing_on: undefined,
          build_trigger_metadata: {},
        }),
      ]),
  });

  it('Git 連携している Worker のビルドを新しい順にまとめる', async () => {
    routes(basic());
    const { getWorkersBuilds } = await load();
    const s = await getWorkersBuilds(env);

    expect(s.workerCount).toBe(2);
    expect(s.builds.map((b) => [b.id, b.worker])).toEqual([
      ['a1', 'api'],
      ['s1', 'site'],
      ['a2', 'api'],
    ]);
    expect(s.detectedPlan).toBe('free');
    expect(s.limitReached).toBe(true);
    // リセット日の1か月前から
    expect(s.period).toEqual({
      start: '2026-11-10T00:00:00.000Z',
      end: '2026-12-10T00:00:00.000Z',
    });
    // 1.5分は切り上げて 2分。a1 は実行中なので今まで（00:01〜05:00）の 299分
    expect(s.usedMinutes).toBe(2 + 299 + 2);

    const [a1, s1, a2] = s.builds;
    expect(s1).toEqual({
      id: 's1',
      worker: 'site',
      status: 'stopped',
      outcome: 'success',
      branch: 'main',
      commitHash: 'abc',
      commitMessage: 'msg',
      source: 'push',
      repo: 'repo',
      createdAt: '2026-11-26T00:00:00Z',
      startedAt: '2026-11-26T00:00:00Z',
      stoppedAt: '2026-11-26T00:01:30.000Z',
      dashboardUrl:
        'https://dash.cloudflare.com/acc 1/workers/services/view/site/production/builds/s1',
    });
    // メタデータがなければ null。開始時刻は initializing → running の順に使う
    expect(a1).toMatchObject({
      outcome: null,
      branch: null,
      commitHash: null,
      commitMessage: null,
      source: null,
      repo: null,
      startedAt: '2026-11-27T00:01:00Z',
      stoppedAt: null,
    });
    expect(a2).toMatchObject({ startedAt: null, branch: null });

    const init = fetchMock.mock.calls[0][1] as RequestInit;
    expect(init.headers).toMatchObject({ Authorization: 'Bearer cf_token' });
  });

  it('latest が配列で返っても trigger から tag を読む', async () => {
    routes({
      ...basic(),
      '/builds/builds/latest': () =>
        ok({
          builds: [
            { trigger: { external_script_id: 'tag-site' } },
            { trigger: null },
          ],
        }),
    });
    const { getWorkersBuilds } = await load();
    const s = await getWorkersBuilds(env);
    expect(s.workerCount).toBe(1);
    expect(s.builds.map((b) => b.id)).toEqual(['s1']);
  });

  it('Worker が多いときは latest を20件ずつに分けて問い合わせる', async () => {
    const scripts = Array.from({ length: 25 }, (_, i) => ({
      id: `w${i}`,
      tag: `t${i}`,
    }));
    routes({
      '/workers/scripts': () => ok(scripts),
      '/builds/account/limits': () => ok(null),
      '/builds/builds/latest': (url) =>
        ok({
          builds: Object.fromEntries(
            (url.searchParams.get('external_script_ids') ?? '')
              .split(',')
              .map((t) => [t, {}]),
          ),
        }),
      '/builds/workers/': () => ok(null),
    });
    const { getWorkersBuilds } = await load();
    const s = await getWorkersBuilds(env);
    const latest = fetchMock.mock.calls
      .map(([u]) => new URL(String(u)))
      .filter((u) => u.pathname.endsWith('/latest'))
      .map((u) => u.searchParams.get('external_script_ids')?.split(','));
    expect(latest.map((ids) => ids?.length)).toEqual([20, 5]);
    expect(s.workerCount).toBe(25);
    // 一覧の上限は30台なので全部問い合わせる
    expect(s.builds).toEqual([]);
    // limits が空なら有料プラン扱い
    expect(s.detectedPlan).toBe('paid');
    expect(s.limitReached).toBe(false);
  });

  it('期間の始まりまでページをさかのぼる（最大3ページ）', async () => {
    const page = (n: number, createdOn: string) =>
      Array.from({ length: 50 }, (_, i) => rawBuild(`p${n}-${i}`, createdOn));
    const pages: number[] = [];
    routes({
      '/workers/scripts': () => ok([{ id: 'w', tag: 't' }]),
      '/builds/account/limits': () => ok({}),
      '/builds/builds/latest': () => ok({ builds: { t: {} } }),
      '/builds/workers/t/builds': (url) => {
        const n = Number(url.searchParams.get('page'));
        pages.push(n);
        // total_pages がなければ「次のページもある」とはみなさない…ので明示する
        return ok(page(n, '2026-11-20T00:00:00Z'), {
          result_info: { total_pages: 9 },
        });
      },
    });
    const { getWorkersBuilds } = await load();
    const s = await getWorkersBuilds(env);
    expect(pages).toEqual([1, 2, 3]);
    expect(s.builds).toHaveLength(10);
    // 有料プランの集計期間はタイムゾーン基準の今月
    expect(s.period.start).toBe('2026-11-01T00:00:00.000Z');
    expect(s.usedMinutes).toBe(150 * 2);
  });

  it('期間より古いビルドが出たら、そこでさかのぼるのをやめる', async () => {
    const pages: number[] = [];
    routes({
      '/workers/scripts': () => ok([{ id: 'w', tag: 't' }]),
      '/builds/account/limits': () => ok({}),
      '/builds/builds/latest': () => ok({ builds: { t: {} } }),
      '/builds/workers/t/builds': (url) => {
        pages.push(Number(url.searchParams.get('page')));
        return ok(
          Array.from({ length: 50 }, (_, i) =>
            rawBuild(`b${i}`, '2026-10-01T00:00:00Z'),
          ),
          { result_info: { total_pages: 5 } },
        );
      },
    });
    const { getWorkersBuilds } = await load();
    await getWorkersBuilds(env);
    expect(pages).toEqual([1]);
  });

  it('最後のページまで来たらやめる', async () => {
    const pages: number[] = [];
    routes({
      '/workers/scripts': () => ok([{ id: 'w', tag: 't' }]),
      '/builds/account/limits': () => ok({}),
      '/builds/builds/latest': () => ok({ builds: { t: {} } }),
      '/builds/workers/t/builds': (url) => {
        pages.push(Number(url.searchParams.get('page')));
        return ok(
          Array.from({ length: 50 }, (_, i) =>
            rawBuild(`b${i}`, '2026-11-20T00:00:00Z'),
          ),
        );
      },
    });
    const { getWorkersBuilds } = await load();
    await getWorkersBuilds(env);
    // total_pages がなければ今のページが最後とみなす
    expect(pages).toEqual([1]);
  });

  it('一部の Worker の取得に失敗しても、残りを返す', async () => {
    routes({
      ...basic(),
      '/builds/workers/tag-api/builds': () => json({}, 500),
    });
    const { getWorkersBuilds } = await load();
    const s = await getWorkersBuilds(env);
    expect(s.builds.map((b) => b.id)).toEqual(['s1']);
  });

  it('全 Worker で失敗したら最初のエラーを投げる', async () => {
    const denied = () =>
      json(
        { success: false, errors: [{ code: 10000, message: 'Auth error' }] },
        403,
      );
    routes({
      ...basic(),
      '/builds/workers/tag-site/builds': denied,
      '/builds/workers/tag-api/builds': denied,
    });
    const { getWorkersBuilds } = await load();
    await expect(getWorkersBuilds(env)).rejects.toMatchObject({
      status: 403,
      message: 'Cloudflare API 403: Auth error',
    });
  });

  it('Git 連携している Worker がなければ空', async () => {
    routes({
      '/workers/scripts': () => ok(null),
      '/builds/account/limits': () => ok({}),
    });
    const { getWorkersBuilds } = await load();
    const s = await getWorkersBuilds(env);
    expect(s).toMatchObject({ builds: [], workerCount: 0, usedMinutes: 0 });
  });

  it('latest の result が空でも落ちない', async () => {
    routes({
      '/workers/scripts': () => ok([{ id: 'w', tag: 't' }]),
      '/builds/account/limits': () => ok({}),
      '/builds/builds/latest': () => ok(null),
    });
    const { getWorkersBuilds } = await load();
    expect((await getWorkersBuilds(env)).workerCount).toBe(0);
  });

  it('limits が取れなくてもビルド一覧は返す（プランは判定しない）', async () => {
    routes({ ...basic(), '/builds/account/limits': () => json({}, 500) });
    const { getWorkersBuilds } = await load();
    const s = await getWorkersBuilds(env);
    expect(s.detectedPlan).toBeNull();
    expect(s.limitReached).toBe(false);
    expect(s.workerCount).toBe(2);
  });

  it('TIMEZONE がなければ日本時間の今月で集計する', async () => {
    routes({
      '/workers/scripts': () => ok([]),
      '/builds/account/limits': () => ok({}),
    });
    const { getWorkersBuilds } = await load();
    const s = await getWorkersBuilds({ ...env, TIMEZONE: undefined });
    expect(s.period.start).toBe('2026-10-31T15:00:00.000Z');
  });

  describe('API のエラー', () => {
    const fail = async (res: () => Response) => {
      routes({ '/workers/scripts': res, '/builds/account/limits': res });
      const { getWorkersBuilds } = await load();
      return getWorkersBuilds(env).catch((e: unknown) => e);
    };

    it.each([
      ['どちらもない', {}],
      ['トークンだけ', { CLOUDFLARE_API_TOKEN: 't' }],
      ['アカウント ID だけ', { CLOUDFLARE_ACCOUNT_ID: 'a' }],
    ])('未設定（%s）なら呼ばずに 500', async (_label, vars) => {
      const { getWorkersBuilds, CloudflareError } = await load();
      const e = await getWorkersBuilds(fakeEnv(vars)).catch((e: unknown) => e);
      expect(e).toBeInstanceOf(CloudflareError);
      expect(e).toMatchObject({ status: 500 });
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it.each([401, 403])('%s は権限不足', async (status) => {
      expect(await fail(() => json({ success: false }, status))).toMatchObject({
        status: 403,
        message: `Cloudflare API ${status}`,
      });
    });

    it('400 でも「Invalid token」は権限不足', async () => {
      expect(
        await fail(() =>
          json({ success: false, errors: [{ message: 'Invalid token' }] }, 400),
        ),
      ).toMatchObject({
        status: 403,
        message: 'Cloudflare API 400: Invalid token',
      });
    });

    it('それ以外はそのステータス', async () => {
      expect(
        await fail(() =>
          json({ success: false, errors: [{ message: 'bad' }] }, 400),
        ),
      ).toMatchObject({ status: 400, message: 'Cloudflare API 400: bad' });
    });

    it('JSON でない応答も API のエラーにする', async () => {
      expect(
        await fail(() => new Response('<html>', { status: 502 })),
      ).toMatchObject({ status: 502, message: 'Cloudflare API 502' });
    });

    it('200 でも success が false ならエラー', async () => {
      expect(
        await fail(() => json({ success: false, errors: [] })),
      ).toMatchObject({ status: 200, message: 'Cloudflare API 200' });
    });
  });

  describe('キャッシュ', () => {
    it('1分間はメモリのキャッシュを返す', async () => {
      routes(basic());
      const { getWorkersBuilds } = await load();
      const a = await getWorkersBuilds(env);
      const calls = fetchMock.mock.calls.length;
      expect(await getWorkersBuilds(env)).toBe(a);
      expect(fetchMock).toHaveBeenCalledTimes(calls);

      vi.setSystemTime(NOW.getTime() + 60_000);
      await getWorkersBuilds(env);
      expect(fetchMock.mock.calls.length).toBe(calls * 2);
    });

    it('エッジキャッシュがあれば保存し、別の isolate からも使う', async () => {
      const cache = fakeCache();
      vi.stubGlobal('caches', { default: cache });
      routes(basic());

      const first = await (await load()).getWorkersBuilds(env);
      const saved = cache.store.get(
        'https://codespacedash.internal/workers-builds',
      );
      expect(saved?.headers.get('Cache-Control')).toBe('max-age=60');

      // 新しい isolate（モジュールを読み直す）ではエッジキャッシュから返す
      vi.resetModules();
      fetchMock.mockClear();
      const { getWorkersBuilds } = await load();
      expect(await getWorkersBuilds(env)).toEqual(first);
      expect(fetchMock).not.toHaveBeenCalled();
      // 読んだ結果はメモリにも持つ
      cache.store.clear();
      expect(await getWorkersBuilds(env)).toEqual(first);
      expect(fetchMock).not.toHaveBeenCalled();
    });
  });
});

describe('getCloudflareToken', () => {
  const VERIFY = '/client/v4/user/tokens/verify';

  it('ユーザー単位のトークンを /user/tokens/verify で確かめ、期限を返す', async () => {
    routes({
      [VERIFY]: () =>
        ok({ id: 't1', status: 'active', expires_on: '2027-05-01T00:00:00Z' }),
    });
    const { getCloudflareToken } = await load();
    expect(await getCloudflareToken(env)).toEqual({
      expiresAt: '2027-05-01T00:00:00Z',
    });
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe(`https://api.cloudflare.com${VERIFY}`);
    expect(init?.headers).toMatchObject({ Authorization: 'Bearer cf_token' });
  });

  it('期限がなければ無期限（null）', async () => {
    routes({ [VERIFY]: () => ok({ id: 't1', status: 'active' }) });
    const { getCloudflareToken } = await load();
    expect(await getCloudflareToken(env)).toEqual({ expiresAt: null });
  });

  it('期限切れは期限の日時をそのまま返す', async () => {
    routes({
      [VERIFY]: () =>
        ok({ status: 'expired', expires_on: '2026-11-01T00:00:00Z' }),
    });
    const { getCloudflareToken } = await load();
    expect(await getCloudflareToken(env)).toEqual({
      expiresAt: '2026-11-01T00:00:00Z',
    });
  });

  it('無効化されたトークンは権限不足（403）', async () => {
    routes({ [VERIFY]: () => ok({ status: 'disabled' }) });
    const { getCloudflareToken } = await load();
    await expect(getCloudflareToken(env)).rejects.toMatchObject({
      status: 403,
      message: 'CLOUDFLARE_API_TOKEN が無効です（disabled）',
    });
  });

  it('トークンがなければ呼ばずにエラー', async () => {
    const { getCloudflareToken } = await load();
    await expect(
      getCloudflareToken(fakeEnv({ CLOUDFLARE_API_TOKEN: '' })),
    ).rejects.toMatchObject({ status: 500 });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
