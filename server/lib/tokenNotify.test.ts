import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fakeEnv, PUSH_VARS } from '../testing/fakeEnv';
import { CloudflareError, getCloudflareToken } from './cloudflare';
import { GithubError, getGithubToken } from './github';
import { sendToAll } from './push';
import { checkTokenExpiry } from './tokenNotify';

vi.mock('./github', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./github')>()),
  getGithubToken: vi.fn(),
}));
vi.mock('./cloudflare', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./cloudflare')>()),
  getCloudflareToken: vi.fn(),
}));
vi.mock('./push', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./push')>()),
  sendToAll: vi.fn(async () => ({ sent: 1, failed: 0, removed: 0 })),
}));

const NOW = new Date('2026-11-27T05:00:00Z');
const inDays = (d: number) =>
  new Date(NOW.getTime() + d * 86_400_000).toISOString();
const CF = { CLOUDFLARE_API_TOKEN: 't', CLOUDFLARE_ACCOUNT_ID: 'a' };

beforeEach(() => {
  vi.useFakeTimers({ now: NOW, toFake: ['Date'] });
  vi.spyOn(console, 'log').mockImplementation(() => {});
  vi.mocked(sendToAll).mockClear();
  vi.mocked(getGithubToken).mockReset();
  vi.mocked(getCloudflareToken).mockReset();
});
afterEach(() => {
  vi.useRealTimers();
});

describe('checkTokenExpiry', () => {
  it('プッシュ通知が未設定なら何もしない', async () => {
    await checkTokenExpiry(fakeEnv());
    expect(getGithubToken).not.toHaveBeenCalled();
  });

  it('期限が近いトークンを通知し、1日は同じ状態で通知しない', async () => {
    vi.mocked(getGithubToken).mockResolvedValue({ expiresAt: inDays(5) });
    const env = fakeEnv(PUSH_VARS);
    await checkTokenExpiry(env);
    expect(sendToAll).toHaveBeenCalledWith(env, {
      title: 'API トークンを確認してください',
      body: 'GitHub のトークンがあと 5 日で期限切れになります',
      url: '/#/settings/tokens',
      tag: 'token-github',
    });
    expect(env.KV.puts).toEqual([
      {
        key: 'token-notified:github:warn',
        value: '1',
        options: { expirationTtl: 86_280 },
      },
    ]);

    await checkTokenExpiry(env);
    expect(sendToAll).toHaveBeenCalledTimes(1);
  });

  it('状態が変われば（警告 → 期限切れ）間隔内でも通知する', async () => {
    const env = fakeEnv(PUSH_VARS);
    await env.KV.put('token-notified:github:warn', '1');
    vi.mocked(getGithubToken).mockResolvedValue({ expiresAt: inDays(-1) });
    await checkTokenExpiry(env);
    expect(vi.mocked(sendToAll).mock.calls[0][1].body).toBe(
      'GitHub のトークンの期限が切れています',
    );
  });

  it('余裕がある・無期限・取得エラーなら通知しない', async () => {
    const env = fakeEnv({ ...PUSH_VARS, ...CF });
    vi.mocked(getGithubToken).mockResolvedValue({ expiresAt: null });
    vi.mocked(getCloudflareToken).mockRejectedValue(new Error('network'));
    await checkTokenExpiry(env);
    vi.mocked(getGithubToken).mockResolvedValue({ expiresAt: inDays(30) });
    await checkTokenExpiry(env);
    expect(sendToAll).not.toHaveBeenCalled();
  });

  it('Cloudflare が設定されていれば確かめ、拒否されたトークンは無効として通知する', async () => {
    const env = fakeEnv({ ...PUSH_VARS, ...CF });
    vi.mocked(getGithubToken).mockRejectedValue(new GithubError(401, 'Bad'));
    vi.mocked(getCloudflareToken).mockRejectedValue(
      new CloudflareError(403, 'Invalid'),
    );
    await checkTokenExpiry(env);
    expect(vi.mocked(sendToAll).mock.calls.map((c) => c[1].body)).toEqual([
      'GitHub のトークンが無効です',
      'Cloudflare のトークンが無効です',
    ]);
  });

  it('Cloudflare が未設定なら GitHub だけ確かめる', async () => {
    vi.mocked(getGithubToken).mockResolvedValue({ expiresAt: inDays(30) });
    await checkTokenExpiry(fakeEnv(PUSH_VARS));
    expect(getCloudflareToken).not.toHaveBeenCalled();
  });
});
