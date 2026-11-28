import {
  alertText,
  needsAttention,
  TOKEN_KEYS,
  type TokenKey,
  tokenStatus,
} from '../../shared/tokens';
import type { SectionState, TokenInfo } from '../../shared/types';
import type { Env } from '../env';
import { getCloudflareToken, workersConfigured } from './cloudflare';
import { getGithubToken } from './github';
import { pushEnabled, sendToAll } from './push';
import { settle } from './section';

const NOTIFIED_PREFIX = 'token-notified:';
/** 同じトークン・同じ状態の再通知は1日1回（Cron のズレで1回飛ばさないよう少し短め） */
const REMIND_SEC = 24 * 60 * 60 - 120;

const fetchers: Record<TokenKey, (env: Env) => Promise<TokenInfo>> = {
  github: getGithubToken,
  cloudflare: getCloudflareToken,
};

/** Cron から呼ばれる：期限が近い・切れた・無効なトークンがあれば通知 */
export const checkTokenExpiry = async (env: Env) => {
  if (!pushEnabled(env)) {
    return;
  }
  const keys = TOKEN_KEYS.filter(
    (k) => k === 'github' || workersConfigured(env),
  );
  for (const key of keys) {
    const state: SectionState<TokenInfo> = await settle(
      () => fetchers[key](env),
      'トークンの再発行',
    );
    const status = tokenStatus(state);
    if (!needsAttention(status)) {
      continue;
    }
    // 状態が変わったら（警告 → 期限切れなど）間隔内でも通知する
    const kvKey = `${NOTIFIED_PREFIX}${key}:${status.level}`;
    if (await env.KV.get(kvKey)) {
      continue;
    }
    const result = await sendToAll(env, {
      title: 'API トークンを確認してください',
      body: alertText({ key, ...status }),
      url: '/#/settings/tokens',
      tag: `token-${key}`,
    });
    console.log('token notified', key, status.level, result);
    await env.KV.put(kvKey, '1', { expirationTtl: REMIND_SEC });
  }
};
