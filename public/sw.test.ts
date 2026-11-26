import { beforeEach, describe, expect, it, vi } from 'vitest';

// Service Worker のグローバル（self）を差し替えて sw.js を読み込み、登録されたハンドラを直接呼ぶ
type Handler = (event: Record<string, unknown>) => void;

const handlers: Record<string, Handler> = {};
const sw = {
  addEventListener: (type: string, h: Handler) => {
    handlers[type] = h;
  },
  skipWaiting: vi.fn(),
  clients: {
    claim: vi.fn(() => Promise.resolve()),
    matchAll: vi.fn(),
    openWindow: vi.fn(async () => null),
  },
  registration: { showNotification: vi.fn(async () => {}) },
  location: { origin: 'https://dash.example.com' },
  navigator: {} as Record<string, unknown>,
};

/** waitUntil に渡された Promise を待てるイベント */
const event = (p: Record<string, unknown> = {}) => {
  let waited: Promise<unknown> = Promise.resolve();
  return {
    ...p,
    waitUntil: (x: Promise<unknown>) => {
      waited = x;
    },
    done: () => waited,
  };
};

const pushData = (body: unknown) => ({
  json: () => {
    if (typeof body !== 'string') {
      return body;
    }
    throw new SyntaxError('not json');
  },
  text: () => body,
});

beforeEach(async () => {
  for (const f of [
    sw.skipWaiting,
    sw.clients.claim,
    sw.clients.matchAll,
    sw.clients.openWindow,
    sw.registration.showNotification,
  ]) {
    f.mockClear();
  }
  sw.navigator = {};
  vi.stubGlobal('self', sw);
  vi.resetModules();
  await import('./sw.js');
});

describe('sw.js', () => {
  it('インストールしたらすぐ有効にし、開いているページを制御する', async () => {
    handlers.install({});
    expect(sw.skipWaiting).toHaveBeenCalled();
    const e = event();
    handlers.activate(e);
    await e.done();
    expect(sw.clients.claim).toHaveBeenCalled();
  });

  describe('push', () => {
    it('ペイロードどおりに通知を出す', async () => {
      const e = event({
        data: pushData({ title: 'T', body: 'B', url: '/x', tag: 'cs-1' }),
      });
      handlers.push(e);
      await e.done();
      expect(sw.registration.showNotification).toHaveBeenCalledWith('T', {
        body: 'B',
        icon: '/icons/icon-192.png',
        badge: '/icons/badge-96.png',
        tag: 'cs-1',
        renotify: true,
        data: { url: '/x' },
      });
    });

    it('中身がなければ既定の文言で出す', async () => {
      const e = event({ data: null });
      handlers.push(e);
      await e.done();
      expect(sw.registration.showNotification).toHaveBeenCalledWith(
        'CodespaceDash',
        expect.objectContaining({
          body: '',
          tag: 'codespacedash',
          data: { url: '/' },
        }),
      );
    });

    it('JSON でなければ本文として出す', async () => {
      const e = event({ data: pushData('plain text') });
      handlers.push(e);
      await e.done();
      expect(sw.registration.showNotification).toHaveBeenCalledWith(
        'CodespaceDash',
        expect.objectContaining({ body: 'plain text' }),
      );
    });

    describe('アプリのバッジ', () => {
      const badge = { set: vi.fn(), clear: vi.fn() };
      beforeEach(() => {
        badge.set.mockReset().mockResolvedValue(undefined);
        badge.clear.mockReset().mockResolvedValue(undefined);
        sw.navigator = { setAppBadge: badge.set, clearAppBadge: badge.clear };
      });

      it('台数があればバッジに出す', async () => {
        const e = event({ data: pushData({ badge: 3 }) });
        handlers.push(e);
        await e.done();
        expect(badge.set).toHaveBeenCalledWith(3);
      });

      it('0 ならバッジを消す', async () => {
        const e = event({ data: pushData({ badge: 0 }) });
        handlers.push(e);
        await e.done();
        expect(badge.clear).toHaveBeenCalled();
      });

      it('バッジの失敗は無視して通知は出す', async () => {
        badge.set.mockRejectedValue(new Error('x'));
        const e = event({ data: pushData({ badge: 1 }) });
        handlers.push(e);
        await expect(e.done()).resolves.toBeDefined();
        expect(sw.registration.showNotification).toHaveBeenCalled();
      });

      it('台数がなければバッジは変えない', async () => {
        const e = event({ data: pushData({ badge: '3' }) });
        handlers.push(e);
        await e.done();
        expect(badge.set).not.toHaveBeenCalled();
        expect(badge.clear).not.toHaveBeenCalled();
      });

      it('Badging API がなければ何もしない', async () => {
        sw.navigator = {};
        const e = event({ data: pushData({ badge: 3 }) });
        handlers.push(e);
        await e.done();
        expect(badge.set).not.toHaveBeenCalled();
        expect(sw.registration.showNotification).toHaveBeenCalled();
      });
    });
  });

  describe('notificationclick', () => {
    const click = (data: unknown) => {
      const close = vi.fn();
      const e = event({ notification: { close, data } });
      handlers.notificationclick(e);
      return { e, close };
    };
    const client = (url: string) => ({
      url,
      focus: vi.fn(async () => {}),
      navigate: vi.fn(async () => {}),
    });

    it('同じオリジンのウィンドウがあれば前に出して移動する', async () => {
      const other = client('https://other.example.com/');
      const mine = client('https://dash.example.com/old');
      sw.clients.matchAll.mockResolvedValue([other, mine]);
      const { e, close } = click({ url: '/next' });
      await e.done();
      expect(close).toHaveBeenCalled();
      expect(sw.clients.matchAll).toHaveBeenCalledWith({
        type: 'window',
        includeUncontrolled: true,
      });
      expect(other.focus).not.toHaveBeenCalled();
      expect(mine.focus).toHaveBeenCalled();
      expect(mine.navigate).toHaveBeenCalledWith(
        'https://dash.example.com/next',
      );
      expect(sw.clients.openWindow).not.toHaveBeenCalled();
    });

    it('なければ新しいウィンドウで開く（URL がなければトップ）', async () => {
      sw.clients.matchAll.mockResolvedValue([
        client('https://other.example.com/'),
      ]);
      const { e } = click(undefined);
      await e.done();
      expect(sw.clients.openWindow).toHaveBeenCalledWith(
        'https://dash.example.com/',
      );
    });

    it('URL のない data でもトップを開く', async () => {
      sw.clients.matchAll.mockResolvedValue([]);
      const { e } = click({});
      await e.done();
      expect(sw.clients.openWindow).toHaveBeenCalledWith(
        'https://dash.example.com/',
      );
    });
  });
});
