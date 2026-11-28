import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Codespace } from '../../shared/types';
import { fakeEnv, PUSH_VARS } from '../testing/fakeEnv';
import { listCodespaces } from './github';
import { checkForgottenCodespaces, isForgotten, minutesSince } from './notify';
import { sendToAll } from './push';

vi.mock('./github', () => ({ listCodespaces: vi.fn() }));
vi.mock('./push', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./push')>()),
  sendToAll: vi.fn(async () => ({ sent: 1, failed: 0, removed: 0 })),
}));

const NOW = new Date('2026-11-27T05:00:00Z');
const ago = (min: number) =>
  new Date(NOW.getTime() - min * 60_000).toISOString();

const cs = (p: Partial<Codespace>): Codespace => ({
  id: 1,
  name: 'cs-1',
  display_name: 'my app',
  state: 'Available',
  machine: null,
  repository: { full_name: 'me/app', html_url: '' },
  created_at: ago(600),
  last_used_at: ago(90),
  location: 'EastUs',
  retention_expires_at: null,
  idle_timeout_minutes: 30,
  web_url: '',
  has_unpushed_changes: false,
  ...p,
});

beforeEach(() => {
  vi.useFakeTimers({ now: NOW, toFake: ['Date'] });
  vi.spyOn(console, 'log').mockImplementation(() => {});
  vi.mocked(sendToAll).mockClear();
});
afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('minutesSince', () => {
  it('経過分数。時刻がなければ 0', () => {
    expect(minutesSince(ago(90))).toBe(90);
    expect(minutesSince(null)).toBe(0);
  });
});

describe('isForgotten', () => {
  it('起動中で、最終使用から指定分数以上たっていたら つけっぱなし', () => {
    expect(isForgotten(cs({ last_used_at: ago(60) }), 60)).toBe(true);
    expect(isForgotten(cs({ last_used_at: ago(59) }), 60)).toBe(false);
  });

  it('停止中は対象外', () => {
    expect(isForgotten(cs({ state: 'Shutdown' }), 60)).toBe(false);
  });
});

describe('checkForgottenCodespaces', () => {
  const env = (p = {}) => fakeEnv({ ...PUSH_VARS, ...p });

  it('プッシュ通知が未設定なら何もしない', async () => {
    await checkForgottenCodespaces(fakeEnv());
    expect(listCodespaces).not.toHaveBeenCalled();
    expect(sendToAll).not.toHaveBeenCalled();
  });

  it('つけっぱなしの1台を通知し、再通知間隔のあいだ通知済みにする', async () => {
    vi.mocked(listCodespaces).mockResolvedValue([
      cs({ last_used_at: ago(45) }),
    ]);
    const e = env({ NOTIFY_AFTER_MIN: '30', REMIND_EVERY_MIN: '120' });
    await checkForgottenCodespaces(e);

    expect(sendToAll).toHaveBeenCalledWith(e, {
      title: 'Codespace がつけっぱなしです',
      body: 'my app（me/app）最終使用から45分',
      url: '/',
      tag: 'cs-1',
      badge: 1,
    });
    // Cron のズレを見込んで2分短く
    expect(e.KV.puts).toEqual([
      { key: 'notified:cs-1', value: '1', options: { expirationTtl: 7080 } },
    ]);
  });

  it('通知済みの Codespace は飛ばす', async () => {
    vi.mocked(listCodespaces).mockResolvedValue([cs({})]);
    const e = env();
    await e.KV.put('notified:cs-1', '1');
    await checkForgottenCodespaces(e);
    expect(sendToAll).not.toHaveBeenCalled();
  });

  it('複数台なら台数をタイトルとバッジに出し、1台ずつ通知する', async () => {
    vi.mocked(listCodespaces).mockResolvedValue([
      cs({ id: 1, name: 'a', display_name: null, last_used_at: ago(185) }),
      cs({ id: 2, name: 'b', display_name: '', last_used_at: ago(60) }),
      // 停止中・最近使ったものは数えない
      cs({ id: 3, name: 'c', state: 'Shutdown', last_used_at: ago(999) }),
      cs({ id: 4, name: 'd', last_used_at: ago(10) }),
    ]);
    await checkForgottenCodespaces(env());

    const payloads = vi.mocked(sendToAll).mock.calls.map(([, p]) => p);
    expect(payloads).toEqual([
      {
        title: 'Codespace がつけっぱなしです（2台）',
        // 表示名がなければ名前を使う
        body: 'a（me/app）最終使用から3時間5分',
        url: '/',
        tag: 'cs-1',
        badge: 2,
      },
      expect.objectContaining({ body: 'b（me/app）最終使用から1時間0分' }),
    ]);
  });

  it('設定がなければ 60分で通知し、TTL は KV の最小の 60秒を下回らない', async () => {
    vi.mocked(listCodespaces).mockResolvedValue([
      cs({ last_used_at: ago(60) }),
    ]);
    const e = env({ REMIND_EVERY_MIN: '1' });
    await checkForgottenCodespaces(e);
    expect(sendToAll).toHaveBeenCalledTimes(1);
    expect(e.KV.puts[0].options).toEqual({ expirationTtl: 60 });
  });

  it('60分未満は分だけで出す（59分 → 1時間0分 の境目の手前）', async () => {
    vi.mocked(listCodespaces).mockResolvedValue([
      cs({ last_used_at: ago(59.99) }),
    ]);
    await checkForgottenCodespaces(env({ NOTIFY_AFTER_MIN: '30' }));
    expect(sendToAll).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ body: 'my app（me/app）最終使用から59分' }),
    );
  });

  it.each([
    ['2', 60],
    ['3', 60],
    ['4', 120],
  ])(
    '再通知の間隔 %s 分の TTL は %s 秒（2分短くし、60秒を下回らない）',
    async (remind, ttl) => {
      vi.mocked(listCodespaces).mockResolvedValue([
        cs({ last_used_at: ago(60) }),
      ]);
      const e = env({ REMIND_EVERY_MIN: remind });
      await checkForgottenCodespaces(e);
      expect(e.KV.puts[0].options).toEqual({ expirationTtl: ttl });
    },
  );

  it('最終使用時刻がなければ 0分扱い（通知しない）', async () => {
    vi.mocked(listCodespaces).mockResolvedValue([cs({ last_used_at: null })]);
    await checkForgottenCodespaces(env());
    expect(sendToAll).not.toHaveBeenCalled();
  });
});
