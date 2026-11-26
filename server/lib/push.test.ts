import { buildPushHTTPRequest } from '@pushforge/builder';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fakeEnv, fakeKv, PUSH_VARS } from '../testing/fakeEnv';
import {
  deleteSubscription,
  parseSubscription,
  pushEnabled,
  saveSubscription,
  sendToAll,
} from './push';

vi.mock('@pushforge/builder', () => ({
  buildPushHTTPRequest: vi.fn(
    async ({ subscription }: { subscription: { endpoint: string } }) => ({
      endpoint: subscription.endpoint,
      headers: { TTL: '3600' },
      body: new Uint8Array([1]),
    }),
  ),
}));

const sub = (endpoint: string) => ({
  endpoint,
  keys: { p256dh: 'BPk3_abc-123', auth: 'auth_Ab-1==' },
});

describe('pushEnabled', () => {
  it('VAPID の3つがそろったときだけ有効', () => {
    expect(pushEnabled(fakeEnv(PUSH_VARS))).toBe(true);
    expect(
      pushEnabled(fakeEnv({ ...PUSH_VARS, VAPID_PUBLIC_KEY: undefined })),
    ).toBe(false);
    expect(
      pushEnabled(fakeEnv({ ...PUSH_VARS, VAPID_PRIVATE_JWK: undefined })),
    ).toBe(false);
    expect(pushEnabled(fakeEnv({ ...PUSH_VARS, VAPID_SUBJECT: '' }))).toBe(
      false,
    );
  });
});

describe('parseSubscription', () => {
  const endpoint = 'https://push.example.com/abc';

  it('必要なフィールドだけに絞る', () => {
    expect(
      parseSubscription({ ...sub(endpoint), expirationTime: null, x: 1 }),
    ).toEqual(sub(endpoint));
  });

  it('上限ちょうどの長さは通す', () => {
    const long = {
      endpoint: `https://${'a'.repeat(2040)}`,
      keys: { p256dh: 'a'.repeat(256), auth: 'a'.repeat(64) },
    };
    expect(parseSubscription(long)).toEqual(long);
  });

  it.each([
    ['null', null],
    ['keys なし', { endpoint }],
    ['endpoint が文字列でない', { ...sub(endpoint), endpoint: 1 }],
    ['長すぎる endpoint', sub(`https://${'a'.repeat(2041)}`)],
    ['https でない endpoint', sub('http://push.example.com/abc')],
    ['p256dh が文字列でない', { endpoint, keys: { p256dh: 1, auth: 'a' } }],
    [
      '長すぎる p256dh',
      { endpoint, keys: { p256dh: 'a'.repeat(257), auth: 'a' } },
    ],
    [
      'p256dh に base64url 以外',
      { endpoint, keys: { p256dh: 'a+b', auth: 'a' } },
    ],
    ['auth が文字列でない', { endpoint, keys: { p256dh: 'a', auth: null } }],
    [
      '長すぎる auth',
      { endpoint, keys: { p256dh: 'a', auth: 'a'.repeat(65) } },
    ],
    [
      'auth に base64url 以外',
      { endpoint, keys: { p256dh: 'a', auth: 'a/b' } },
    ],
  ])('%s は不正', (_label, body) => {
    expect(() => parseSubscription(body)).toThrow('購読情報が不正です');
  });
});

describe('saveSubscription / deleteSubscription', () => {
  it('endpoint のハッシュをキーにして保存し、同じ endpoint で消せる', async () => {
    const env = fakeEnv(PUSH_VARS);
    const s = sub('https://push.example.com/abc');
    await saveSubscription(env, s);

    const [key] = [...env.KV.store.keys()];
    expect(key).toMatch(/^sub:[0-9a-f]{64}$/);
    // endpoint そのものはキーに出さない
    expect(key).not.toContain('push.example.com');
    expect(JSON.parse(env.KV.store.get(key) as string)).toEqual(s);

    await deleteSubscription(env, s.endpoint);
    expect(env.KV.store.size).toBe(0);
  });
});

describe('sendToAll', () => {
  const payload = { title: 't', body: 'b', url: '/', tag: 'test' };
  const fetchMock = vi.fn<typeof fetch>();

  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal('fetch', fetchMock);
    vi.spyOn(console, 'warn').mockImplementation(() => {});
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('未設定なら何も送らない', async () => {
    expect(await sendToAll(fakeEnv(), payload)).toEqual({
      sent: 0,
      failed: 0,
      removed: 0,
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('全端末に送り、失効した購読（404/410）は消す', async () => {
    // 2件ずつのページに分けて、cursor をたどることも確かめる
    const env = fakeEnv({ ...PUSH_VARS, KV: fakeKv(2) });
    for (const p of ['ok', 'gone', 'notfound', 'error', 'throw']) {
      await saveSubscription(env, sub(`https://push.example.com/${p}`));
    }
    // 購読以外のキー（通知済みフラグ）は対象外
    await env.KV.put('notified:cs', '1');
    // 一覧には出るが中身が消えている購読は飛ばす
    await env.KV.put('sub:dangling', 'null');

    fetchMock.mockImplementation(async (input) => {
      const url = String(input);
      if (url.endsWith('/throw')) {
        throw new Error('network');
      }
      const status = { gone: 410, notfound: 404, error: 500 }[
        url.split('/').at(-1) as string
      ];
      return new Response('x', { status: status ?? 201 });
    });

    expect(await sendToAll(env, payload)).toEqual({
      sent: 1,
      failed: 2,
      removed: 2,
    });
    expect(fetchMock).toHaveBeenCalledTimes(5);
    expect(fetchMock.mock.calls[0][1]).toMatchObject({
      method: 'POST',
      headers: { TTL: '3600' },
    });
    expect(vi.mocked(buildPushHTTPRequest).mock.calls[0][0]).toMatchObject({
      privateJWK: PUSH_VARS.VAPID_PRIVATE_JWK,
      message: {
        payload,
        adminContact: PUSH_VARS.VAPID_SUBJECT,
        options: { ttl: 3600, urgency: 'high', topic: 'test' },
      },
    });
    // 410/404 の2件だけ消える
    expect(env.KV.store.size).toBe(5);
    expect(env.KV.store.has('notified:cs')).toBe(true);
  });
});
