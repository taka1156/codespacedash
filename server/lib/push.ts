import { buildPushHTTPRequest } from '@pushforge/builder';
import type { PushPayload, PushSubscriptionBody } from '../../shared/types';
import type { Env } from '../env';

const SUB_PREFIX = 'sub:';

export const pushEnabled = (env: Env) =>
  Boolean(env.VAPID_PUBLIC_KEY && env.VAPID_PRIVATE_JWK && env.VAPID_SUBJECT);

const sha256 = async (s: string) => {
  const buf = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(s),
  );
  return [...new Uint8Array(buf)]
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
};

const keyFor = async (endpoint: string) =>
  `${SUB_PREFIX}${await sha256(endpoint)}`;

/** ブラウザから来た購読情報を検証して、必要なフィールドだけにする */
export const parseSubscription = (body: unknown): PushSubscriptionBody => {
  const b = body as Partial<PushSubscriptionBody> | null;
  const endpoint = b?.endpoint;
  const p256dh = b?.keys?.p256dh;
  const auth = b?.keys?.auth;
  const b64url = /^[A-Za-z0-9_-]+={0,2}$/;
  if (
    typeof endpoint !== 'string' ||
    endpoint.length > 2048 ||
    !endpoint.startsWith('https://') ||
    typeof p256dh !== 'string' ||
    p256dh.length > 256 ||
    !b64url.test(p256dh) ||
    typeof auth !== 'string' ||
    auth.length > 64 ||
    !b64url.test(auth)
  ) {
    throw new Error('購読情報が不正です');
  }
  return { endpoint, keys: { p256dh, auth } };
};

export const saveSubscription = async (env: Env, sub: PushSubscriptionBody) => {
  await env.KV.put(await keyFor(sub.endpoint), JSON.stringify(sub));
};

export const deleteSubscription = async (env: Env, endpoint: string) => {
  await env.KV.delete(await keyFor(endpoint));
};

const listSubscriptions = async (env: Env) => {
  const subs: { key: string; sub: PushSubscriptionBody }[] = [];
  let cursor: string | undefined;
  do {
    const page = await env.KV.list({ prefix: SUB_PREFIX, cursor });
    for (const k of page.keys) {
      const sub = await env.KV.get<PushSubscriptionBody>(k.name, 'json');
      if (sub) {
        subs.push({ key: k.name, sub });
      }
    }
    cursor = page.list_complete ? undefined : page.cursor;
  } while (cursor);
  return subs;
};

/** 登録済みの全端末に送信。失効した購読（404/410）は削除する */
export const sendToAll = async (env: Env, payload: PushPayload) => {
  if (!pushEnabled(env)) {
    return { sent: 0, failed: 0, removed: 0 };
  }
  const subs = await listSubscriptions(env);
  let sent = 0;
  let failed = 0;
  let removed = 0;

  await Promise.all(
    subs.map(async ({ key, sub }) => {
      try {
        const req = await buildPushHTTPRequest({
          privateJWK: env.VAPID_PRIVATE_JWK as string,
          subscription: sub,
          message: {
            payload: { ...payload },
            adminContact: env.VAPID_SUBJECT as string,
            options: { ttl: 60 * 60, urgency: 'high', topic: payload.tag },
          },
        });
        const res = await fetch(req.endpoint, {
          method: 'POST',
          headers: req.headers,
          body: req.body,
        });
        if (res.ok) {
          sent++;
        } else if (res.status === 404 || res.status === 410) {
          await env.KV.delete(key);
          removed++;
        } else {
          failed++;
          console.warn('push failed', res.status, await res.text());
        }
      } catch (e) {
        failed++;
        console.warn('push error', e);
      }
    }),
  );
  return { sent, failed, removed };
};
