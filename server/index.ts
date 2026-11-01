import { Hono } from 'hono';
import { secureHeaders } from 'hono/secure-headers';
import {
  type ApiErrorBody,
  CSRF_HEADER,
  CSRF_VALUE,
  type DashboardResponse,
  type PushConfigResponse,
} from '../shared/types';
import { type AppEnv, type Env, numVar } from './env';
import { cloudflareAccess } from './lib/access';
import {
  currentPeriod,
  GithubError,
  getBillingSummary,
  getPremiumRequests,
  getUser,
  listCodespaces,
  stopCodespace,
} from './lib/github';
import { checkForgottenCodespaces } from './lib/notify';
import {
  deleteSubscription,
  parseSubscription,
  pushEnabled,
  saveSubscription,
  sendToAll,
} from './lib/push';

const api = new Hono<AppEnv>().basePath('/api');

api.use(secureHeaders());
api.use(cloudflareAccess);
api.use(async (c, next) => {
  // 非GETはカスタムヘッダー必須（クロスオリジンからは preflight で弾かれる）
  if (c.req.method !== 'GET' && c.req.header(CSRF_HEADER) !== CSRF_VALUE) {
    return c.json<ApiErrorBody>({ error: 'Forbidden' }, 403);
  }
  await next();
  c.header('Cache-Control', 'no-store');
});

const message = (r: PromiseSettledResult<unknown>) =>
  r.status === 'rejected'
    ? r.reason instanceof Error
      ? r.reason.message
      : String(r.reason)
    : undefined;

api.get('/dashboard', async (c) => {
  const user = await getUser(c.env);
  const period = currentPeriod(c.env.TIMEZONE);

  // 1つ失敗しても他のパネルは表示できるよう個別に扱う
  const [codespaces, billing, copilot] = await Promise.allSettled([
    listCodespaces(c.env),
    getBillingSummary(c.env, user.login, period),
    getPremiumRequests(c.env, user.login, period),
  ]);

  const errors: DashboardResponse['errors'] = {};
  const cErr = message(codespaces);
  const bErr = message(billing);
  const pErr = message(copilot);
  if (cErr) {
    errors.codespaces = cErr;
  }
  if (bErr) {
    errors.billing = bErr;
  }
  if (pErr) {
    errors.copilot = pErr;
  }

  return c.json<DashboardResponse>({
    user,
    codespaces: codespaces.status === 'fulfilled' ? codespaces.value : null,
    billingSummary: billing.status === 'fulfilled' ? billing.value : null,
    premiumRequests: copilot.status === 'fulfilled' ? copilot.value : null,
    errors,
    notifyAfterMin: numVar(c.env.NOTIFY_AFTER_MIN, 60),
    fetchedAt: new Date().toISOString(),
  });
});

api.post('/codespaces/:name/stop', async (c) => {
  await stopCodespace(c.env, c.req.param('name'));
  return c.json({ ok: true });
});

// ── Web Push ──
api.get('/push/config', (c) =>
  c.json<PushConfigResponse>({
    enabled: pushEnabled(c.env),
    publicKey: pushEnabled(c.env) ? (c.env.VAPID_PUBLIC_KEY ?? null) : null,
  }),
);

api.post('/push/subscriptions', async (c) => {
  if (!pushEnabled(c.env)) {
    return c.json<ApiErrorBody>({ error: 'プッシュ通知が未設定です' }, 503);
  }
  let sub: ReturnType<typeof parseSubscription>;
  try {
    sub = parseSubscription(await c.req.json());
  } catch (e) {
    return c.json<ApiErrorBody>({ error: (e as Error).message }, 400);
  }
  await saveSubscription(c.env, sub);
  return c.json({ ok: true }, 201);
});

api.delete('/push/subscriptions', async (c) => {
  const { endpoint } = await c.req.json<{ endpoint?: unknown }>();
  if (typeof endpoint !== 'string') {
    return c.json<ApiErrorBody>({ error: 'endpoint が必要です' }, 400);
  }
  await deleteSubscription(c.env, endpoint);
  return c.json({ ok: true });
});

api.post('/push/test', async (c) => {
  const result = await sendToAll(c.env, {
    title: 'CodespaceDash',
    body: 'テスト通知です。この端末で通知を受け取れます。',
    url: '/',
    tag: 'test',
  });
  return c.json(result);
});

api.notFound((c) => c.json<ApiErrorBody>({ error: 'Not Found' }, 404));

api.onError((err, c) => {
  if (err instanceof GithubError) {
    // GitHub の 401/403 はトークン設定の問題なので 502 で返し、Access のセッション切れと区別する
    const status = err.status === 400 ? 400 : 502;
    return c.json<ApiErrorBody>({ error: err.message }, status);
  }
  console.error(err);
  return c.json<ApiErrorBody>({ error: 'Internal Server Error' }, 500);
});

export default {
  fetch: api.fetch,
  async scheduled(_controller, env, ctx) {
    ctx.waitUntil(checkForgottenCodespaces(env));
  },
} satisfies ExportedHandler<Env>;
