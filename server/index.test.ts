import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CSRF_HEADER, CSRF_VALUE } from '../shared/types';
import type { Env } from './env';
import worker from './index';
import { CloudflareError, getWorkersBuilds } from './lib/cloudflare';
import { getCloudflareUsage } from './lib/cloudflareUsage';
import {
  GithubError,
  getBillingSummary,
  getPremiumRequests,
  getUser,
  listCodespaces,
  listRecentRuns,
  stopCodespace,
} from './lib/github';
import { checkForgottenCodespaces } from './lib/notify';
import { sendToAll } from './lib/push';
import { fakeEnv, PUSH_VARS } from './testing/fakeEnv';

// API を呼ぶ関数だけ差し替える（判定・検証の関数は本物を使う）
vi.mock('./lib/github', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./lib/github')>()),
  getUser: vi.fn(),
  listCodespaces: vi.fn(),
  getBillingSummary: vi.fn(),
  getPremiumRequests: vi.fn(),
  listRecentRuns: vi.fn(),
  stopCodespace: vi.fn(),
}));
vi.mock('./lib/cloudflare', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./lib/cloudflare')>()),
  getWorkersBuilds: vi.fn(),
}));
vi.mock('./lib/cloudflareUsage', () => ({ getCloudflareUsage: vi.fn() }));
vi.mock('./lib/notify', () => ({ checkForgottenCodespaces: vi.fn() }));
vi.mock('./lib/push', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./lib/push')>()),
  sendToAll: vi.fn(),
}));

const NOW = new Date('2026-11-27T05:00:00Z');
const USER = {
  login: 'me',
  name: null,
  avatar_url: '',
  html_url: '',
  plan: 'pro',
};

/** Access の設定がない localhost として呼ぶ（Access の検証は access.test.ts で確かめる） */
const call = (
  path: string,
  init: RequestInit & { csrf?: boolean } = {},
  env: Env = fakeEnv(),
) => {
  const { csrf = init.method !== undefined, ...rest } = init;
  return worker.fetch(
    new Request(`http://localhost${path}`, {
      ...rest,
      headers: {
        ...(csrf ? { [CSRF_HEADER]: CSRF_VALUE } : {}),
        ...(rest.body ? { 'Content-Type': 'application/json' } : {}),
        ...rest.headers,
      },
    }),
    env,
    {} as ExecutionContext,
  );
};

beforeEach(() => {
  vi.useFakeTimers({ now: NOW, toFake: ['Date'] });
  vi.resetAllMocks();
  vi.mocked(getUser).mockResolvedValue(USER);
  vi.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('共通', () => {
  it('Access の設定がなければローカル以外は拒否する', async () => {
    const res = await worker.fetch(
      new Request('https://dash.example.com/api/push/config'),
      fakeEnv(),
      {} as ExecutionContext,
    );
    expect(res.status).toBe(500);
  });

  it('応答はキャッシュさせず、セキュリティヘッダーを付ける', async () => {
    const res = await call('/api/push/config');
    expect(res.headers.get('Cache-Control')).toBe('no-store');
    expect(res.headers.get('X-Content-Type-Options')).toBe('nosniff');
  });

  it.each(['POST', 'DELETE'])(
    '%s は CSRF ヘッダーがなければ 403',
    async (method) => {
      const res = await call('/api/push/test', { method, csrf: false });
      expect(res.status).toBe(403);
      expect(await res.json()).toEqual({ error: 'Forbidden' });
      expect(sendToAll).not.toHaveBeenCalled();
    },
  );

  it('CSRF ヘッダーの値が違っても 403', async () => {
    const res = await call('/api/push/test', {
      method: 'POST',
      csrf: false,
      headers: { [CSRF_HEADER]: 'XMLHttpRequest' },
    });
    expect(res.status).toBe(403);
  });

  it('知らないパスは JSON の 404', async () => {
    const res = await call('/api/nope');
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: 'Not Found' });
  });
});

describe('GET /api/dashboard', () => {
  const mockAll = () => {
    vi.mocked(listCodespaces).mockResolvedValue([]);
    vi.mocked(getBillingSummary).mockResolvedValue({
      timePeriod: { year: 2026, month: 11 },
      usageItems: [],
    });
    vi.mocked(listRecentRuns).mockRejectedValue(new GithubError(403, 'no'));
    vi.mocked(getPremiumRequests).mockRejectedValue(new Error('boom'));
  };

  it('項目ごとに取得状態を返す（1つ失敗しても他は返す）', async () => {
    mockAll();
    const res = await call(
      '/api/dashboard',
      {},
      fakeEnv({ TIMEZONE: 'UTC', NOTIFY_AFTER_MIN: '45' }),
    );
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      user: USER,
      github: {
        codespaces: { status: 'ok', data: [] },
        billing: {
          status: 'ok',
          data: { timePeriod: { year: 2026, month: 11 }, usageItems: [] },
        },
        runs: {
          status: 'forbidden',
          permission: 'Actions: Read（Repository permissions）',
          message: 'no',
        },
        copilot: { status: 'error', message: 'boom' },
      },
      cloudflare: {
        builds: {
          status: 'unconfigured',
          setting: 'CLOUDFLARE_API_TOKEN と CLOUDFLARE_ACCOUNT_ID',
        },
        usage: {
          status: 'unconfigured',
          setting: 'CLOUDFLARE_API_TOKEN と CLOUDFLARE_ACCOUNT_ID',
        },
      },
      notifyAfterMin: 45,
      fetchedAt: NOW.toISOString(),
    });
    expect(getBillingSummary).toHaveBeenCalledWith(expect.anything(), 'me', {
      year: 2026,
      month: 11,
    });
    expect(getWorkersBuilds).not.toHaveBeenCalled();
  });

  it('Cloudflare が設定されていれば Workers Builds と使用量も取る', async () => {
    mockAll();
    vi.mocked(getWorkersBuilds).mockRejectedValue(
      new CloudflareError(403, 'denied'),
    );
    vi.mocked(getCloudflareUsage).mockResolvedValue({
      daily: {},
      monthly: {},
      dayStart: '',
      monthStart: '',
    } as never);
    const res = await call(
      '/api/dashboard',
      {},
      fakeEnv({ CLOUDFLARE_API_TOKEN: 't', CLOUDFLARE_ACCOUNT_ID: 'a' }),
    );
    const body = await res.json<{
      cloudflare: Record<string, { status: string }>;
      notifyAfterMin: number;
    }>();
    expect(body.cloudflare.builds).toMatchObject({
      status: 'forbidden',
      permission: expect.stringContaining('Workers Builds Configuration'),
    });
    expect(body.cloudflare.usage.status).toBe('ok');
    expect(body.notifyAfterMin).toBe(60);
  });

  it('ユーザーが取れなければ 502', async () => {
    vi.mocked(getUser).mockRejectedValue(new GithubError(401, 'Bad creds'));
    const res = await call('/api/dashboard');
    expect(res.status).toBe(502);
    expect(await res.json()).toEqual({ error: 'Bad creds' });
  });
});

describe('POST /api/codespaces/:name/stop', () => {
  it('停止する', async () => {
    const res = await call('/api/codespaces/my-cs/stop', { method: 'POST' });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
    expect(stopCodespace).toHaveBeenCalledWith(expect.anything(), 'my-cs');
  });

  it('名前が不正なら 400 のまま返す', async () => {
    vi.mocked(stopCodespace).mockRejectedValue(new GithubError(400, '不正'));
    const res = await call('/api/codespaces/x/stop', { method: 'POST' });
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: '不正' });
  });
});

describe('エラー処理', () => {
  it('Cloudflare のエラーは 502', async () => {
    vi.mocked(getUser).mockRejectedValue(new CloudflareError(500, 'cf down'));
    const res = await call('/api/dashboard');
    expect(res.status).toBe(502);
    expect(await res.json()).toEqual({ error: 'cf down' });
  });

  it('想定外のエラーは中身を出さずに 500', async () => {
    vi.mocked(getUser).mockRejectedValue(new Error('secret detail'));
    const res = await call('/api/dashboard');
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ error: 'Internal Server Error' });
    expect(console.error).toHaveBeenCalled();
  });
});

describe('Web Push', () => {
  const sub = {
    endpoint: 'https://push.example.com/abc',
    keys: { p256dh: 'p', auth: 'a' },
  };

  it('未設定なら無効と返し、公開鍵は出さない', async () => {
    const res = await call(
      '/api/push/config',
      {},
      fakeEnv({ VAPID_PUBLIC_KEY: 'pub' }),
    );
    expect(await res.json()).toEqual({ enabled: false, publicKey: null });
  });

  it('設定済みなら公開鍵を返す', async () => {
    const res = await call('/api/push/config', {}, fakeEnv(PUSH_VARS));
    expect(await res.json()).toEqual({ enabled: true, publicKey: 'pub' });
  });

  it('未設定なら購読を受け付けない', async () => {
    const res = await call('/api/push/subscriptions', {
      method: 'POST',
      body: JSON.stringify(sub),
    });
    expect(res.status).toBe(503);
  });

  it('購読を保存し、同じ endpoint で削除できる', async () => {
    const env = fakeEnv(PUSH_VARS);
    const res = await call(
      '/api/push/subscriptions',
      { method: 'POST', body: JSON.stringify({ ...sub, extra: 1 }) },
      env,
    );
    expect(res.status).toBe(201);
    expect([...env.KV.store.values()]).toEqual([JSON.stringify(sub)]);

    const del = await call(
      '/api/push/subscriptions',
      { method: 'DELETE', body: JSON.stringify({ endpoint: sub.endpoint }) },
      env,
    );
    expect(del.status).toBe(200);
    expect(env.KV.store.size).toBe(0);
  });

  it('不正な購読情報は 400', async () => {
    const res = await call(
      '/api/push/subscriptions',
      { method: 'POST', body: JSON.stringify({ endpoint: 'http://x' }) },
      fakeEnv(PUSH_VARS),
    );
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: '購読情報が不正です' });
  });

  it('削除は endpoint が必要', async () => {
    const res = await call('/api/push/subscriptions', {
      method: 'DELETE',
      body: JSON.stringify({ endpoint: 1 }),
    });
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: 'endpoint が必要です' });
  });

  it('テスト通知を送って結果を返す', async () => {
    vi.mocked(sendToAll).mockResolvedValue({ sent: 2, failed: 0, removed: 1 });
    const res = await call('/api/push/test', { method: 'POST' });
    expect(await res.json()).toEqual({ sent: 2, failed: 0, removed: 1 });
    expect(sendToAll).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ tag: 'test', url: '/' }),
    );
  });
});

describe('scheduled', () => {
  it('消し忘れの確認を waitUntil で走らせる', async () => {
    const p = Promise.resolve();
    vi.mocked(checkForgottenCodespaces).mockReturnValue(p);
    const waitUntil = vi.fn();
    const env = fakeEnv();
    await worker.scheduled({} as ScheduledController, env, {
      waitUntil,
    } as unknown as ExecutionContext);
    expect(checkForgottenCodespaces).toHaveBeenCalledWith(env);
    expect(waitUntil).toHaveBeenCalledWith(p);
  });
});
