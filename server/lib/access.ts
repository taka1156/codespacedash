import { createMiddleware } from 'hono/factory';
import { Jwt } from 'hono/utils/jwt';
import type { AppEnv } from '../env';

const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]']);

/**
 * Cloudflare Access の JWT を検証する。
 * Access の前段を通らずに Worker に届いたリクエスト（設定漏れのホスト名など）を弾くための多重防御。
 * ACCESS_TEAM_DOMAIN / ACCESS_AUD が未設定なら、ローカル開発時を除いて全て拒否（fail-closed）。
 */
export const cloudflareAccess = createMiddleware<AppEnv>(async (c, next) => {
  const team = c.env.ACCESS_TEAM_DOMAIN?.replace(/^https?:\/\//, '').replace(
    /\/$/,
    '',
  );
  const aud = c.env.ACCESS_AUD;

  if (!team || !aud) {
    if (LOCAL_HOSTS.has(new URL(c.req.url).hostname)) {
      return next();
    }
    return c.json(
      { error: 'ACCESS_TEAM_DOMAIN / ACCESS_AUD が設定されていません' },
      500,
    );
  }

  const token = c.req.header('Cf-Access-Jwt-Assertion');
  if (!token) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  try {
    await Jwt.verifyWithJwks(
      token,
      {
        jwks_uri: `https://${team}/cdn-cgi/access/certs`,
        allowedAlgorithms: ['RS256'],
        verification: { iss: `https://${team}`, aud },
      },
      // 公開鍵は1時間エッジでキャッシュ
      { cf: { cacheTtl: 3600, cacheEverything: true } } as RequestInit,
    );
  } catch {
    return c.json({ error: 'Unauthorized' }, 401);
  }
  return next();
});
