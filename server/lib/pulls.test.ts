import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fakeEnv, json } from '../testing/fakeEnv';

// listRepoCandidates はモジュール内にキャッシュを持つので、テストごとに読み直す
const load = () => import('./pulls');

const NOW = new Date('2026-11-27T05:00:00Z');
const env = fakeEnv();
const fetchMock = vi.fn<typeof fetch>();

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

const rawPull = (p: Record<string, unknown> = {}) => ({
  number: 12,
  title: 'feat: PR タブ',
  url: 'https://github.com/me/app/pull/12',
  isDraft: false,
  createdAt: '2026-11-26T00:00:00Z',
  updatedAt: '2026-11-27T00:00:00Z',
  headRefName: 'feat/pulls',
  reviewDecision: null,
  author: { login: 'me' },
  comments: { totalCount: 3 },
  ...p,
});

const rawRepo = (name: string, nodes: unknown[], p = {}) => ({
  nameWithOwner: name,
  url: `https://github.com/${name}`,
  isPrivate: false,
  pullRequests: { totalCount: nodes.length, nodes },
  ...p,
});

describe('parseRepoList', () => {
  it('カンマ区切りを配列にして、空白・空要素・重複を除く', async () => {
    const { parseRepoList } = await load();
    expect(parseRepoList(' me/app , ,me/APP,other/lib,')).toEqual([
      'me/app',
      'other/lib',
    ]);
  });

  it('指定がなければ空', async () => {
    const { parseRepoList } = await load();
    expect(parseRepoList(undefined)).toEqual([]);
    expect(parseRepoList('')).toEqual([]);
  });

  it('URL で渡されても owner/repo にそろえる', async () => {
    const { parseRepoList } = await load();
    expect(parseRepoList('https://github.com/me/app')).toEqual(['me/app']);
  });

  it('不正な名前があれば 400', async () => {
    const { parseRepoList } = await load();
    const { GithubError } = await import('./github');
    const e = (() => {
      try {
        parseRepoList('me/app,bad name');
      } catch (e) {
        return e;
      }
    })();
    expect(e).toBeInstanceOf(GithubError);
    expect(e).toMatchObject({
      status: 400,
      message: 'リポジトリ名が不正です: bad name',
    });
  });

  it('上限を超えたら 400', async () => {
    const { parseRepoList } = await load();
    const many = Array.from({ length: 31 }, (_, i) => `me/r${i}`).join(',');
    expect(() => parseRepoList(many)).toThrow(/30 件まで/);
    const max = Array.from({ length: 30 }, (_, i) => `me/r${i}`).join(',');
    expect(parseRepoList(max)).toHaveLength(30);
  });
});

describe('buildQuery', () => {
  it('リポジトリごとに別名を付け、名前は変数で渡す', async () => {
    const { buildQuery } = await load();
    const { query, variables } = buildQuery(['me/app', 'org/lib']);
    expect(variables).toEqual({ o0: 'me', n0: 'app', o1: 'org', n1: 'lib' });
    expect(query).toContain(
      'query($o0: String!, $n0: String!, $o1: String!, $n1: String!)',
    );
    expect(query).toContain('r0: repository(owner: $o0, name: $n0)');
    expect(query).toContain('r1: repository(owner: $o1, name: $n1)');
    expect(query).toContain('pullRequests(states: OPEN, first: 10');
    // 名前そのものはクエリに埋め込まない
    expect(query).not.toContain('app');
  });
});

describe('listPullRequests', () => {
  it('登録がなければ呼ばない', async () => {
    const { listPullRequests } = await load();
    expect(await listPullRequests(env, [])).toEqual([]);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('GraphQL を1回だけ POST で呼ぶ', async () => {
    fetchMock.mockResolvedValue(json({ data: { r0: rawRepo('me/app', []) } }));
    const { listPullRequests } = await load();
    await listPullRequests(env, ['me/app']);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('https://api.github.com/graphql');
    expect(init?.method).toBe('POST');
    expect(JSON.parse(String(init?.body)).variables).toEqual({
      o0: 'me',
      n0: 'app',
    });
  });

  it('必要なフィールドだけにして、登録した順に返す', async () => {
    fetchMock.mockResolvedValue(
      json({
        data: {
          r0: rawRepo('org/lib', [], {
            isPrivate: true,
            pullRequests: { totalCount: 0, nodes: [] },
          }),
          r1: rawRepo('me/app', [
            rawPull(),
            rawPull({
              number: 11,
              isDraft: true,
              reviewDecision: 'APPROVED',
              author: null,
            }),
            rawPull({ number: 10, reviewDecision: 'CHANGES_REQUESTED' }),
            rawPull({ number: 9, reviewDecision: 'REVIEW_REQUIRED' }),
          ]),
        },
      }),
    );
    const { listPullRequests } = await load();
    const res = await listPullRequests(env, ['org/lib', 'me/app']);
    expect(res[0]).toEqual({
      repo: 'org/lib',
      found: true,
      url: 'https://github.com/org/lib',
      private: true,
      totalCount: 0,
      pulls: [],
    });
    expect(res[1].repo).toBe('me/app');
    expect(res[1].totalCount).toBe(4);
    expect(res[1].pulls[0]).toEqual({
      number: 12,
      title: 'feat: PR タブ',
      url: 'https://github.com/me/app/pull/12',
      draft: false,
      author: 'me',
      branch: 'feat/pulls',
      createdAt: '2026-11-26T00:00:00Z',
      updatedAt: '2026-11-27T00:00:00Z',
      review: null,
      comments: 3,
    });
    expect(
      res[1].pulls.slice(1).map((p) => [p.draft, p.author, p.review]),
    ).toMatchInlineSnapshot(`
      [
        [
          true,
          null,
          "approved",
        ],
        [
          false,
          "me",
          "changes_requested",
        ],
        [
          false,
          "me",
          "review_required",
        ],
      ]
    `);
  });

  it('見つからないリポジトリは found: false にして、他は返す', async () => {
    fetchMock.mockResolvedValue(
      json({
        data: { r0: null, r1: rawRepo('me/app', [rawPull()]) },
        errors: [{ type: 'NOT_FOUND', message: 'Could not resolve' }],
      }),
    );
    const { listPullRequests } = await load();
    const res = await listPullRequests(env, ['me/gone', 'me/app']);
    expect(res[0]).toEqual({
      repo: 'me/gone',
      found: false,
      url: 'https://github.com/me/gone',
      private: false,
      totalCount: 0,
      pulls: [],
    });
    expect(res[1].found).toBe(true);
  });

  it('data がなければエラー（FORBIDDEN は 403）', async () => {
    const { listPullRequests } = await load();
    fetchMock.mockResolvedValueOnce(
      json({ data: null, errors: [{ type: 'FORBIDDEN', message: 'no' }] }),
    );
    await expect(listPullRequests(env, ['me/app'])).rejects.toMatchObject({
      status: 403,
      message: 'GitHub GraphQL: no',
    });
    fetchMock.mockResolvedValueOnce(
      json({ errors: [{ message: 'Something went wrong' }] }),
    );
    await expect(listPullRequests(env, ['me/app'])).rejects.toMatchObject({
      status: 502,
      message: 'GitHub GraphQL: Something went wrong',
    });
    fetchMock.mockResolvedValueOnce(json({}));
    await expect(listPullRequests(env, ['me/app'])).rejects.toMatchObject({
      status: 502,
      message: 'GitHub GraphQL: データがありません',
    });
  });

  it('HTTP のエラーはそのまま投げる', async () => {
    fetchMock.mockResolvedValue(json({ message: 'Bad credentials' }, 401));
    const { listPullRequests } = await load();
    await expect(listPullRequests(env, ['me/app'])).rejects.toMatchObject({
      status: 401,
    });
  });
});

describe('listRepoCandidates', () => {
  it('アーカイブ済みと形の違う名前を除き、push が新しい順のまま返す', async () => {
    fetchMock.mockResolvedValue(
      json([
        { full_name: 'me/new', archived: false },
        { full_name: 'me/old', archived: true },
        { full_name: 'weird', archived: false },
        { full_name: 'org/lib', archived: false },
      ]),
    );
    const { listRepoCandidates } = await load();
    expect(await listRepoCandidates(env)).toEqual(['me/new', 'org/lib']);
    expect(String(fetchMock.mock.calls[0][0])).toBe(
      'https://api.github.com/user/repos?sort=pushed&direction=desc&per_page=100',
    );
  });

  it('10分はキャッシュを返し、過ぎたら取り直す', async () => {
    fetchMock.mockImplementation(async () =>
      json([{ full_name: 'me/app', archived: false }]),
    );
    const { listRepoCandidates } = await load();
    await listRepoCandidates(env);
    vi.setSystemTime(NOW.getTime() + 10 * 60_000 - 1);
    await listRepoCandidates(env);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    vi.setSystemTime(NOW.getTime() + 10 * 60_000);
    await listRepoCandidates(env);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
