import type { AppSettings } from '../../shared/types';
import type { Env } from '../env';

const SETTINGS_KEY = 'settings';

const DEFAULTS: AppSettings = { notifyStartStop: true };

export const getSettings = async (env: Env): Promise<AppSettings> => ({
  ...DEFAULTS,
  ...((await env.KV.get<Partial<AppSettings>>(SETTINGS_KEY, 'json')) ?? {}),
});

/** 既知の項目だけを受け付けて保存する */
export const updateSettings = async (
  env: Env,
  patch: unknown,
): Promise<AppSettings> => {
  const p = (patch ?? {}) as Partial<Record<keyof AppSettings, unknown>>;
  const next = await getSettings(env);
  if (typeof p.notifyStartStop === 'boolean') {
    next.notifyStartStop = p.notifyStartStop;
  }
  await env.KV.put(SETTINGS_KEY, JSON.stringify(next));
  return next;
};
