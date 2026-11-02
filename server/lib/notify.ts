import type { Codespace } from '../../shared/types';
import { type Env, numVar } from '../env';
import { listCodespaces } from './github';
import { pushEnabled, sendToAll } from './push';

const NOTIFIED_PREFIX = 'notified:';

export const minutesSince = (iso: string | null) =>
  iso ? (Date.now() - new Date(iso).getTime()) / 60_000 : 0;

export const isForgotten = (cs: Codespace, afterMin: number) =>
  cs.state === 'Available' && minutesSince(cs.last_used_at) >= afterMin;

const fmtElapsed = (min: number) =>
  min < 60
    ? `${Math.floor(min)}分`
    : `${Math.floor(min / 60)}時間${Math.floor(min % 60)}分`;

/** Cron から呼ばれる：つけっぱなしの Codespace があれば通知 */
export const checkForgottenCodespaces = async (env: Env) => {
  if (!pushEnabled(env)) {
    console.log('push is not configured; skip');
    return;
  }
  const afterMin = numVar(env.NOTIFY_AFTER_MIN, 60);
  const remindMin = numVar(env.REMIND_EVERY_MIN, 60);

  const forgotten = (await listCodespaces(env)).filter((c) =>
    isForgotten(c, afterMin),
  );

  for (const cs of forgotten) {
    const key = `${NOTIFIED_PREFIX}${cs.name}`;
    if (await env.KV.get(key)) {
      continue; // 再通知間隔内
    }
    const result = await sendToAll(env, {
      title:
        forgotten.length > 1
          ? `Codespace がつけっぱなしです（${forgotten.length}台）`
          : 'Codespace がつけっぱなしです',
      body: `${cs.display_name || cs.name}（${cs.repository.full_name}）最終使用から${fmtElapsed(minutesSince(cs.last_used_at))}`,
      url: '/',
      tag: `cs-${cs.id}`,
      badge: forgotten.length,
    });
    console.log('notified', cs.name, result);
    // Cron の実行タイミングのズレで1回飛ばさないよう少し短めにする（KV の最小TTLは60秒）
    await env.KV.put(key, '1', {
      expirationTtl: Math.max(60, remindMin * 60 - 120),
    });
  }
};
