import { Hono } from 'hono';
import { Jwt } from 'hono/utils/jwt';
import {
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';
import type { AppEnv } from '../env';
import { fakeEnv, json } from '../testing/fakeEnv';
import { cloudflareAccess } from './access';

const TEAM = 'team.cloudflareaccess.com';
const AUD = 'aud-tag';

let privateJwk: JsonWebKey & { kid: string };
let publicJwk: JsonWebKey & { kid: string };

beforeAll(async () => {
  const pair = (await crypto.subtle.generateKey(
    {
      name: 'RSASSA-PKCS1-v1_5',
      modulusLength: 2048,
      publicExponent: new Uint8Array([1, 0, 1]),
      hash: 'SHA-256',
    },
    true,
    ['sign', 'verify'],
  )) as CryptoKeyPair;
  privateJwk = {
    ...((await crypto.subtle.exportKey('jwk', pair.privateKey)) as JsonWebKey),
    kid: 'k1',
  };
  publicJwk = {
    ...((await crypto.subtle.exportKey('jwk', pair.publicKey)) as JsonWebKey),
    kid: 'k1',
    alg: 'RS256',
  };
});

const fetchMock = vi.fn<typeof fetch>();
beforeEach(() => {
  fetchMock.mockReset();
  fetchMock.mockImplementation(async () => json({ keys: [publicJwk] }));
  vi.stubGlobal('fetch', fetchMock);
});
afterEach(() => {
  vi.unstubAllGlobals();
});

const token = (p: Record<string, unknown> = {}) =>
  Jwt.sign(
    {
      iss: `https://${TEAM}`,
      aud: AUD,
      exp: Math.floor(Date.now() / 1000) + 60,
      ...p,
    },
    privateJwk,
    'RS256',
  );

const app = new Hono<AppEnv>()
  .use(cloudflareAccess)
  .get('/', (c) => c.text('ok'));

const call = (
  url: string,
  env: Partial<Omit<AppEnv['Bindings'], 'KV'>>,
  headers: Record<string, string> = {},
) => app.request(url, { headers }, fakeEnv(env));

describe('cloudflareAccess', () => {
  describe('ACCESS_TEAM_DOMAIN / ACCESS_AUD が未設定', () => {
    it.each(['localhost', '127.0.0.1', '[::1]'])(
      'ローカル（%s）は通す',
      async (host) => {
        const res = await call(`http://${host}:5173/`, {});
        expect(res.status).toBe(200);
        expect(await res.text()).toBe('ok');
      },
    );

    it('ローカル以外は全て拒否する', async () => {
      const res = await call('https://dash.example.com/', {});
      expect(res.status).toBe(500);
      expect(await res.json()).toEqual({
        error: 'ACCESS_TEAM_DOMAIN / ACCESS_AUD が設定されていません',
      });
    });

    it('片方だけでも拒否する', async () => {
      expect(
        (await call('https://x.example.com/', { ACCESS_TEAM_DOMAIN: TEAM }))
          .status,
      ).toBe(500);
      expect(
        (await call('https://x.example.com/', { ACCESS_AUD: AUD })).status,
      ).toBe(500);
    });
  });

  describe('設定あり', () => {
    const env = { ACCESS_TEAM_DOMAIN: TEAM, ACCESS_AUD: AUD };

    it('正しい JWT なら通し、チームの公開鍵を1時間キャッシュして取る', async () => {
      const res = await call('https://dash.example.com/', env, {
        'Cf-Access-Jwt-Assertion': await token(),
      });
      expect(res.status).toBe(200);
      const [url, init] = fetchMock.mock.calls[0];
      expect(url).toBe(`https://${TEAM}/cdn-cgi/access/certs`);
      expect(init).toMatchObject({
        cf: { cacheTtl: 3600, cacheEverything: true },
      });
    });

    it('チームドメインに https:// や末尾の / が付いていても使える', async () => {
      const res = await call(
        'https://dash.example.com/',
        { ...env, ACCESS_TEAM_DOMAIN: `https://${TEAM}/` },
        { 'Cf-Access-Jwt-Assertion': await token() },
      );
      expect(res.status).toBe(200);
      expect(fetchMock.mock.calls[0][0]).toBe(
        `https://${TEAM}/cdn-cgi/access/certs`,
      );
    });

    it('ローカルでも JWT がなければ拒否する（設定があれば常に検証する）', async () => {
      const res = await call('http://localhost/', env);
      expect(res.status).toBe(401);
      expect(await res.json()).toEqual({ error: 'Unauthorized' });
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it.each([
      ['aud が違う', { aud: 'other' }],
      ['iss が違う', { iss: 'https://evil.cloudflareaccess.com' }],
      ['期限切れ', { exp: Math.floor(Date.now() / 1000) - 60 }],
    ])('%s JWT は拒否する', async (_label, p) => {
      const res = await call('https://dash.example.com/', env, {
        'Cf-Access-Jwt-Assertion': await token(p),
      });
      expect(res.status).toBe(401);
    });

    it('壊れた JWT は拒否する', async () => {
      const res = await call('https://dash.example.com/', env, {
        'Cf-Access-Jwt-Assertion': 'not.a.jwt',
      });
      expect(res.status).toBe(401);
    });
  });
});
