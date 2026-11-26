import type { Env } from '../env';

/** テスト用のメモリ上の KV。put の options（TTL など）も記録する */
export const fakeKv = (pageSize = Number.POSITIVE_INFINITY) => {
  const store = new Map<string, string>();
  const puts: { key: string; value: string; options?: unknown }[] = [];
  return {
    store,
    puts,
    async get(key: string, type?: string) {
      const v = store.get(key);
      if (v === undefined) {
        return null;
      }
      return type === 'json' ? JSON.parse(v) : v;
    },
    async put(key: string, value: string, options?: unknown) {
      store.set(key, value);
      puts.push({ key, value, options });
    },
    async delete(key: string) {
      store.delete(key);
    },
    /** pageSize ごとに cursor（次の開始位置）を付けて返す */
    async list({ prefix = '', cursor }: { prefix?: string; cursor?: string }) {
      const keys = [...store.keys()].filter((k) => k.startsWith(prefix));
      const from = cursor ? Number(cursor) : 0;
      const to = from + pageSize;
      return {
        keys: keys.slice(from, to).map((name) => ({ name })),
        list_complete: to >= keys.length,
        cursor: String(to),
      };
    },
  };
};

export type FakeKv = ReturnType<typeof fakeKv>;

export const fakeEnv = (
  p: Partial<Omit<Env, 'KV'>> & { KV?: FakeKv } = {},
): Env & { KV: FakeKv } =>
  ({
    GITHUB_TOKEN: 'ghp_test',
    ASSETS: {} as Fetcher,
    ...p,
    KV: p.KV ?? fakeKv(),
  }) as unknown as Env & { KV: FakeKv };

/** VAPID 鍵がそろった（プッシュ通知が有効な）設定 */
export const PUSH_VARS = {
  VAPID_PUBLIC_KEY: 'pub',
  VAPID_PRIVATE_JWK: '{"kty":"EC"}',
  VAPID_SUBJECT: 'mailto:test@example.com',
} as const;

/** Response を JSON で作る */
export const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });

/** Workers の caches.default の代わり */
export const fakeCache = () => {
  const store = new Map<string, Response>();
  return {
    store,
    async match(req: Request) {
      return store.get(req.url)?.clone();
    },
    async put(req: Request, res: Response) {
      store.set(req.url, res);
    },
  };
};
