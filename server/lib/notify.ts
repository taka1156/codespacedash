import type { Codespace } from '../../shared/types';
import { type Env, numVar } from '../env';
import { listCodespaces } from './github';
import { pushEnabled, sendToAll } from './push';
import { getSettings } from './settings';

const NOTIFIED_PREFIX = 'notified:';
const UP_STATES_KEY = 'up-states';

export const minutesSince = (iso: string | null) =>
  iso ? (Date.now() - new Date(iso).getTime()) / 60_000 : 0;

export const isForgotten = (cs: Codespace, afterMin: number) =>
  cs.state === 'Available' && minutesSince(cs.last_used_at) >= afterMin;

const fmtElapsed = (min: number) =>
  min < 60
    ? `${Math.floor(min)}分`
    : `${Math.floor(min / 60)}時間${Math.floor(min % 60)}分`;

const label = (cs: Codespace) =>
  `${cs.display_name || cs.name}（${cs.repository.full_name}）`;

// 起動中とみなす状態 / 途中経過なので判定を保留する状態
const UP = new Set(['Available', 'Rebuilding']);
const TRANSITIONAL = new Set([
  'Starting',
  'Stopping',
  'ShuttingDown',
  'Queued',
  'Provisioning',
  'Awaiting',
  'Updating',
  'Exporting',
]);

/**
 * 前回のチェックから「起動した」「止まった」Codespace を通知する。
 * 設定がオフでも状態の記録は続ける（オンに戻したときに古い状態で誤通知しないため）
 */
const notifyStartStop = async (
  env: Env,
  codespaces: Codespace[],
  enabled: boolean,
) => {
  const prev = await env.KV.get<Record<string, boolean>>(UP_STATES_KEY, 'json');
  const next: Record<string, boolean> = {};

  for (const cs of codespaces) {
    // 起動処理中・停止処理中は前回の判定を引き継ぐ
    next[cs.name] = TRANSITIONAL.has(cs.state)
      ? (prev?.[cs.name] ?? false)
      : UP.has(cs.state);
  }

  // 初回は比較対象がないので保存だけ
  if (prev && enabled) {
    for (const cs of codespaces) {
      const was = prev[cs.name] ?? false;
      const now = next[cs.name];
      if (!was && now) {
        await sendToAll(env, {
          title: 'Codespace を起動しました',
          body: label(cs),
          url: '/',
          tag: `cs-${cs.id}-state`,
        });
      } else if (was && !now) {
        await sendToAll(env, {
          title: 'Codespace が停止しました',
          body: label(cs),
          url: '/',
          tag: `cs-${cs.id}-state`,
        });
      }
    }
    // 起動中だったのに一覧から消えた（削除された）もの
    const current = new Set(codespaces.map((c) => c.name));
    for (const [name, was] of Object.entries(prev)) {
      if (was && !current.has(name)) {
        await sendToAll(env, {
          title: 'Codespace が停止しました',
          body: `${name}（削除されました）`,
          url: '/',
          tag: `cs-${name}-state`,
        });
      }
    }
  }

  // KV の書き込みは状態が変わったときだけ
  if (JSON.stringify(prev) !== JSON.stringify(next)) {
    await env.KV.put(UP_STATES_KEY, JSON.stringify(next));
  }
};

/** つけっぱなしの Codespace があれば通知 */
const notifyForgotten = async (env: Env, codespaces: Codespace[]) => {
  const afterMin = numVar(env.NOTIFY_AFTER_MIN, 60);
  const remindMin = numVar(env.REMIND_EVERY_MIN, 60);
  const forgotten = codespaces.filter((c) => isForgotten(c, afterMin));

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
      body: `${label(cs)}最終使用から${fmtElapsed(minutesSince(cs.last_used_at))}`,
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

/** Cron から呼ばれる */
export const checkForgottenCodespaces = async (env: Env) => {
  if (!pushEnabled(env)) {
    console.log('push is not configured; skip');
    return;
  }
  const codespaces = await listCodespaces(env);
  const settings = await getSettings(env);

  await notifyStartStop(env, codespaces, settings.notifyStartStop);
  await notifyForgotten(env, codespaces);
};
