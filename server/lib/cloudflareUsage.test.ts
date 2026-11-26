import { afterEach, describe, expect, it, vi } from 'vitest';
import { fakeEnv, json } from '../testing/fakeEnv';
import { CloudflareError } from './cloudflare';
import {
  createGql,
  fetchCloudflareUsage,
  type Gql,
  getCloudflareUsage,
  isAuthzError,
  latestPerKey,
  parseGqlResponse,
  r2OperationClass,
  sumRows,
  usagePeriods,
} from './cloudflareUsage';

const NOW = new Date('2026-11-27T05:30:00Z');

describe('usagePeriods', () => {
  it('日次は UTC の 0 時、月次は UTC の1日から', () => {
    expect(usagePeriods(NOW)).toEqual({
      dayStart: '2026-11-27T00:00:00.000Z',
      today: '2026-11-27',
      yesterday: '2026-11-26',
      monthStart: '2026-11-01T00:00:00.000Z',
      now: '2026-11-27T05:30:00.000Z',
    });
  });

  it('日本時間の朝（UTC では前日）は UTC の日付で区切る', () => {
    // 2026-12-01 08:00 JST = 2026-11-30 23:00 UTC
    const p = usagePeriods(new Date('2026-11-30T23:00:00Z'));
    expect(p.today).toBe('2026-11-30');
    expect(p.monthStart).toBe('2026-11-01T00:00:00.000Z');
  });

  it('月初の昨日は前月の末日', () => {
    expect(usagePeriods(new Date('2026-12-01T01:00:00Z')).yesterday).toBe(
      '2026-11-30',
    );
  });
});

describe('r2OperationClass', () => {
  it.each([
    ['PutObject', 'A'],
    ['ListObjects', 'A'],
    ['CompleteMultipartUpload', 'A'],
    ['GetObject', 'B'],
    ['HeadObject', 'B'],
    ['DeleteObject', 'free'],
    ['AbortMultipartUpload', 'free'],
    // 一覧にない操作は名前から推定
    ['GetBucketWebsite', 'B'],
    ['PutBucketTagging', 'A'],
  ] as const)('%s → %s', (action, cls) => {
    expect(r2OperationClass(action)).toBe(cls);
  });
});

describe('sumRows', () => {
  it('複数行の値を合計し、数値でないものは 0 とみなす', () => {
    expect(sumRows([{ v: 3 }, { v: 4.5 }, { v: null }, {}], (r) => r.v)).toBe(
      7.5,
    );
  });

  it('NaN・Infinity も 0 とみなす', () => {
    expect(
      sumRows(
        [{ v: 1 }, { v: Number.NaN }, { v: Number.POSITIVE_INFINITY }],
        (r) => r.v,
      ),
    ).toBe(1);
  });

  it('行がなければ 0', () => {
    expect(sumRows(null, () => 1)).toBe(0);
  });
});

describe('latestPerKey', () => {
  it('キーごとの最新値だけを合計する（日ごとに足して二重に数えない）', () => {
    const rows = [
      { k: 'a', t: '2026-11-26', v: 100 },
      { k: 'a', t: '2026-11-27', v: 120 },
      { k: 'b', t: '2026-11-26', v: 50 },
    ];
    expect(
      latestPerKey(
        rows,
        (r) => r.k,
        (r) => r.t,
        (r) => r.v,
      ),
    ).toBe(170);
  });
});

describe('isAuthzError / parseGqlResponse', () => {
  const ok = { data: { viewer: { accounts: [{ rows: [] }] } }, errors: null };

  it('accounts[0] を返す', () => {
    expect(parseGqlResponse(200, ok)).toEqual({ rows: [] });
  });

  it('HTTP 200 でも認可エラーなら 403 にする', () => {
    const body = {
      data: null,
      errors: [{ message: 'not authorized for that account' }],
    };
    expect(isAuthzError(body.errors[0])).toBe(true);
    expect(() => parseGqlResponse(200, body)).toThrow(
      expect.objectContaining({ status: 403 }),
    );
  });

  it('extensions.code で認可エラーを判定する', () => {
    expect(isAuthzError({ message: 'x', extensions: { code: 'authz' } })).toBe(
      true,
    );
  });

  it('フィールド名の間違いなどは 502（権限不足ではない）', () => {
    const body = {
      data: null,
      errors: [{ message: 'unknown field "neurons"' }],
    };
    expect(() => parseGqlResponse(200, body)).toThrow(
      expect.objectContaining({ status: 502 }),
    );
  });

  it('HTTP 401/403 は権限不足', () => {
    expect(() => parseGqlResponse(401, null)).toThrow(CloudflareError);
    expect(() => parseGqlResponse(401, null)).toThrow(
      expect.objectContaining({ status: 403 }),
    );
  });

  it('アカウントが返らなければ権限不足として扱う', () => {
    expect(() =>
      parseGqlResponse(200, { data: { viewer: { accounts: [] } } }),
    ).toThrow(expect.objectContaining({ status: 403 }));
  });
});

/** クエリに含まれるデータセット名で応答を切り替える疑似 GraphQL */
const fakeGql =
  (
    responses: Record<string, Record<string, unknown>[] | Error>,
    calls: string[] = [],
  ): Gql =>
  async (query) => {
    const name = Object.keys(responses).find((k) => query.includes(k));
    if (!name) {
      throw new Error(`unexpected query: ${query}`);
    }
    calls.push(name);
    const r = responses[name];
    if (r instanceof Error) {
      throw r;
    }
    return { rows: r };
  };

const allOk = {
  workersInvocationsAdaptive: [
    { sum: { requests: 1200 } },
    { sum: { requests: 300 } },
  ],
  aiInferenceAdaptiveGroups: [{ sum: { totalNeurons: 4321.5 } }],
  d1AnalyticsAdaptiveGroups: [{ sum: { rowsRead: 90_000, rowsWritten: 800 } }],
  kvOperationsAdaptiveGroups: [
    { sum: { requests: 500 }, dimensions: { actionType: 'read' } },
    { sum: { requests: 20 }, dimensions: { actionType: 'write' } },
    { sum: { requests: 7 }, dimensions: { actionType: 'delete' } },
    { sum: { requests: 2 }, dimensions: { actionType: 'list' } },
    { sum: { requests: 1 }, dimensions: { actionType: 'list' } },
  ],
  r2OperationsAdaptiveGroups: [
    { sum: { requests: 40 }, dimensions: { actionType: 'PutObject' } },
    { sum: { requests: 5 }, dimensions: { actionType: 'ListObjects' } },
    { sum: { requests: 900 }, dimensions: { actionType: 'GetObject' } },
    { sum: { requests: 3 }, dimensions: { actionType: 'DeleteObject' } },
  ],
  r2StorageAdaptiveGroups: [
    {
      max: { payloadSize: 2 * 1024 ** 3, metadataSize: 0 },
      dimensions: { bucketName: 'assets', datetime: '2026-11-27T00:00:00Z' },
    },
    {
      max: { payloadSize: 1 * 1024 ** 3, metadataSize: 0 },
      dimensions: { bucketName: 'assets', datetime: '2026-11-26T00:00:00Z' },
    },
    {
      max: { payloadSize: 0.5 * 1024 ** 3, metadataSize: 0 },
      dimensions: { bucketName: 'logs', datetime: '2026-11-26T12:00:00Z' },
    },
  ],
  kvStorageAdaptiveGroups: [
    {
      max: { byteCount: 0.1 * 1024 ** 3 },
      dimensions: { namespaceId: 'ns1', date: '2026-11-26' },
    },
    {
      max: { byteCount: 0.2 * 1024 ** 3 },
      dimensions: { namespaceId: 'ns1', date: '2026-11-27' },
    },
    {
      max: { byteCount: 0.05 * 1024 ** 3 },
      dimensions: { namespaceId: 'ns2', date: '2026-11-27' },
    },
  ],
  d1StorageAdaptiveGroups: [
    {
      max: { databaseSizeBytes: 0.25 * 1024 ** 3 },
      dimensions: { databaseId: 'db1', date: '2026-11-27' },
    },
  ],
};

describe('fetchCloudflareUsage', () => {
  it('各データセットを項目ごとの値にまとめる', async () => {
    const u = await fetchCloudflareUsage(fakeGql(allOk), NOW);
    const val = (s: { status: string; data?: number }) =>
      s.status === 'ok' ? s.data : s.status;
    expect(
      Object.fromEntries(Object.entries(u.daily).map(([k, v]) => [k, val(v)])),
    ).toEqual({
      workersRequests: 1500,
      workersAiNeurons: 4321.5,
      d1RowsRead: 90_000,
      d1RowsWritten: 800,
      kvReads: 500,
      kvWrites: 20,
      kvDeletes: 7,
      kvLists: 3,
    });
    expect(
      Object.fromEntries(
        Object.entries(u.monthly).map(([k, v]) => [k, val(v)]),
      ),
    ).toEqual({
      r2StorageGb: 2.5,
      r2ClassA: 45,
      r2ClassB: 900,
      d1StorageGb: 0.25,
      // ns1 は最新の 0.2、ns2 の 0.05 を足す（日ごとに足さない）
      kvStorageGb: 0.25,
    });
    expect(u.dayStart).toBe('2026-11-27T00:00:00.000Z');
  });

  it('2項目を取るデータセットは1回だけ問い合わせる', async () => {
    const calls: string[] = [];
    await fetchCloudflareUsage(fakeGql(allOk, calls), NOW);
    expect(calls.filter((c) => c === 'd1AnalyticsAdaptiveGroups')).toHaveLength(
      1,
    );
    expect(
      calls.filter((c) => c === 'kvOperationsAdaptiveGroups'),
    ).toHaveLength(1);
    expect(
      calls.filter((c) => c === 'r2OperationsAdaptiveGroups'),
    ).toHaveLength(1);
  });

  it('1つのデータセットが失敗しても、その項目だけがエラーになる', async () => {
    const u = await fetchCloudflareUsage(
      fakeGql({
        ...allOk,
        aiInferenceAdaptiveGroups: new CloudflareError(502, 'unknown field'),
      }),
      NOW,
    );
    expect(u.daily.workersAiNeurons).toEqual({
      status: 'error',
      message: 'unknown field',
    });
    expect(u.daily.workersRequests.status).toBe('ok');
    expect(u.monthly.r2ClassA.status).toBe('ok');
  });

  it('権限不足は足りない権限名を添えて返す（同じクエリの2項目とも）', async () => {
    const u = await fetchCloudflareUsage(
      fakeGql({
        ...allOk,
        d1AnalyticsAdaptiveGroups: new CloudflareError(403, 'not authorized'),
      }),
      NOW,
    );
    for (const s of [u.daily.d1RowsRead, u.daily.d1RowsWritten]) {
      expect(s).toMatchObject({
        status: 'forbidden',
        permission: 'Account Analytics: Read',
      });
    }
  });

  it('データがなければ 0', async () => {
    const empty = Object.fromEntries(
      Object.keys(allOk).map((k) => [k, []]),
    ) as Record<string, []>;
    const u = await fetchCloudflareUsage(fakeGql(empty), NOW);
    expect(u.daily.kvWrites).toEqual({ status: 'ok', data: 0 });
    expect(u.monthly.r2StorageGb).toEqual({ status: 'ok', data: 0 });
  });
});

describe('latestPerKey（新旧の順番）', () => {
  it('古い行があとに来ても最新の値を残す', () => {
    const rows = [
      { k: 'a', t: '2026-11-27', v: 120 },
      { k: 'a', t: '2026-11-26', v: 100 },
    ];
    expect(
      latestPerKey(
        rows,
        (r) => r.k,
        (r) => r.t,
        (r) => r.v,
      ),
    ).toBe(120);
  });

  it('行がなければ 0', () => {
    expect(
      latestPerKey(
        undefined,
        () => '',
        () => '',
        () => 1,
      ),
    ).toBe(0);
  });
});

describe('isAuthzError / parseGqlResponse（文言がないとき）', () => {
  it('message も code もなければ認可エラーではない', () => {
    expect(isAuthzError({})).toBe(false);
  });

  it('認可エラーの文言がなければ既定の文言', () => {
    expect(() => parseGqlResponse(403, {})).toThrow('権限がありません');
  });

  it('HTTP エラーで errors がなければ既定の文言', () => {
    expect(() => parseGqlResponse(500, null)).toThrow(
      expect.objectContaining({
        status: 502,
        message: expect.stringContaining('応答が不正です'),
      }),
    );
  });

  it('errors が null でも accounts を読む', () => {
    expect(() => parseGqlResponse(200, { data: null })).toThrow(
      'アカウントが見つかりません',
    );
  });
});

describe('fetchCloudflareUsage（欠けたフィールド）', () => {
  it('rows や dimensions がなくても 0 として数える', async () => {
    const gql: Gql = async (query) =>
      query.includes('r2StorageAdaptiveGroups') ||
      query.includes('d1StorageAdaptiveGroups') ||
      query.includes('kvStorageAdaptiveGroups') ||
      query.includes('r2OperationsAdaptiveGroups')
        ? {
            rows: [
              {
                sum: { requests: 4 },
                max: {
                  payloadSize: 1024 ** 3,
                  databaseSizeBytes: 1024 ** 3,
                  byteCount: 1024 ** 3,
                },
              },
            ],
          }
        : {};
    const u = await fetchCloudflareUsage(gql, NOW);
    expect(u.daily.workersRequests).toEqual({ status: 'ok', data: 0 });
    // actionType がない操作は Class A 扱い（名前から推定できないので状態を変える操作とみなす）
    expect(u.monthly.r2ClassA).toEqual({ status: 'ok', data: 4 });
    expect(u.monthly.r2StorageGb).toEqual({ status: 'ok', data: 1 });
    expect(u.monthly.d1StorageGb).toEqual({ status: 'ok', data: 1 });
    expect(u.monthly.kvStorageGb).toEqual({ status: 'ok', data: 1 });
  });

  it('now を省略すると現在時刻で集計する', async () => {
    vi.useFakeTimers({ now: NOW, toFake: ['Date'] });
    const u = await fetchCloudflareUsage(async () => ({ rows: [] }));
    vi.useRealTimers();
    expect(u.dayStart).toBe('2026-11-27T00:00:00.000Z');
  });
});

describe('createGql / getCloudflareUsage', () => {
  const fetchMock = vi.fn<typeof fetch>();
  afterEach(() => {
    fetchMock.mockReset();
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });
  const env = fakeEnv({
    CLOUDFLARE_API_TOKEN: 'cf_token',
    CLOUDFLARE_ACCOUNT_ID: 'acc',
  });
  const okBody = { data: { viewer: { accounts: [{ rows: [] }] } } };

  it('トークンとアカウントを付けて GraphQL を呼ぶ', async () => {
    vi.stubGlobal('fetch', fetchMock);
    fetchMock.mockResolvedValue(json(okBody));
    expect(await createGql(env)('query', { a: 1 })).toEqual({ rows: [] });
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('https://api.cloudflare.com/client/v4/graphql');
    expect(init?.headers).toMatchObject({ Authorization: 'Bearer cf_token' });
    expect(JSON.parse(init?.body as string)).toEqual({
      query: 'query',
      variables: { accountTag: 'acc', a: 1 },
    });
  });

  it('JSON でない応答はエラー', async () => {
    vi.stubGlobal('fetch', fetchMock);
    fetchMock.mockResolvedValue(new Response('<html>', { status: 502 }));
    await expect(createGql(env)('q', {})).rejects.toMatchObject({
      status: 502,
    });
  });

  it('1分間はメモリのキャッシュを返す', async () => {
    vi.useFakeTimers({ now: NOW, toFake: ['Date'] });
    vi.stubGlobal('fetch', fetchMock);
    fetchMock.mockImplementation(async () => json(okBody));

    const a = await getCloudflareUsage(env);
    const calls = fetchMock.mock.calls.length;
    expect(calls).toBeGreaterThan(0);
    expect(await getCloudflareUsage(env)).toBe(a);
    expect(fetchMock.mock.calls.length).toBe(calls);

    vi.setSystemTime(NOW.getTime() + 60_000);
    expect(await getCloudflareUsage(env)).not.toBe(a);
    expect(fetchMock.mock.calls.length).toBe(calls * 2);
  });
});
