import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { api } from '@/lib/api';
import { usePush } from './usePush';

vi.mock('@/lib/api', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/api')>()),
  api: { get: vi.fn(), post: vi.fn(), delete: vi.fn() },
}));

const get = vi.mocked(api.get);
const post = vi.mocked(api.post);
const del = vi.mocked(api.delete);

const flush = () => act(async () => {});

const sub = {
  endpoint: 'https://push.example.com/abc',
  toJSON: () => ({ endpoint: 'https://push.example.com/abc', keys: {} }),
  unsubscribe: vi.fn(async () => true),
};
const pushManager = {
  getSubscription: vi.fn(),
  subscribe: vi.fn(),
};
const notification = {
  permission: 'default' as NotificationPermission,
  requestPermission: vi.fn(),
};

/** 対応ブラウザにする（Service Worker・Push・Notification をそろえる） */
const supportPush = () => {
  Object.defineProperty(navigator, 'serviceWorker', {
    configurable: true,
    value: { ready: Promise.resolve({ pushManager }) },
  });
  vi.stubGlobal('PushManager', class {});
  vi.stubGlobal('Notification', notification);
};

const env = (p: {
  ua?: string;
  platform?: string;
  touch?: number;
  standaloneMedia?: boolean;
  standalone?: boolean;
}) => {
  vi.spyOn(navigator, 'userAgent', 'get').mockReturnValue(
    p.ua ?? 'Mozilla/5.0 (X11; Linux)',
  );
  vi.spyOn(navigator, 'platform', 'get').mockReturnValue(
    p.platform ?? 'Linux x86_64',
  );
  Object.defineProperty(navigator, 'maxTouchPoints', {
    configurable: true,
    value: p.touch ?? 0,
  });
  Object.defineProperty(navigator, 'standalone', {
    configurable: true,
    value: p.standalone,
  });
  vi.stubGlobal(
    'matchMedia',
    vi.fn(() => ({ matches: p.standaloneMedia ?? false })),
  );
};

beforeEach(() => {
  get.mockReset().mockResolvedValue({ enabled: true, publicKey: 'BAa-_w' });
  post.mockReset().mockResolvedValue({ ok: true });
  del.mockReset().mockResolvedValue({ ok: true });
  pushManager.getSubscription.mockReset().mockResolvedValue(null);
  pushManager.subscribe.mockReset().mockResolvedValue(sub);
  sub.unsubscribe.mockClear();
  notification.permission = 'default';
  notification.requestPermission.mockReset().mockResolvedValue('granted');
  env({});
});
afterEach(() => {
  delete (navigator as { serviceWorker?: unknown }).serviceWorker;
});

describe('usePush の状態', () => {
  it('最初は loading', () => {
    supportPush();
    const { result } = renderHook(() => usePush());
    expect(result.current.status).toBe('loading');
  });

  it('購読していなければ off、していれば on', async () => {
    supportPush();
    const a = renderHook(() => usePush());
    await flush();
    expect(a.result.current.status).toBe('off');
    expect(get).toHaveBeenCalledWith('/push/config');

    pushManager.getSubscription.mockResolvedValue(sub);
    const b = renderHook(() => usePush());
    await flush();
    expect(b.result.current.status).toBe('on');
  });

  it('サーバーで未設定なら disabled', async () => {
    supportPush();
    get.mockResolvedValue({ enabled: false, publicKey: null });
    const { result } = renderHook(() => usePush());
    await flush();
    expect(result.current.status).toBe('disabled');
  });

  it('通知がブロックされていれば denied', async () => {
    supportPush();
    notification.permission = 'denied';
    const { result } = renderHook(() => usePush());
    await flush();
    expect(result.current.status).toBe('denied');
  });

  it('確認中に失敗したら unsupported', async () => {
    supportPush();
    get.mockRejectedValue(new Error('x'));
    const { result } = renderHook(() => usePush());
    await flush();
    expect(result.current.status).toBe('unsupported');
  });

  describe('非対応のブラウザ', () => {
    it.each([
      [
        'Service Worker がない',
        () => {
          vi.stubGlobal('PushManager', class {});
          vi.stubGlobal('Notification', notification);
        },
      ],
      [
        'PushManager がない',
        () => {
          supportPush();
          vi.stubGlobal('PushManager', undefined);
          delete (window as { PushManager?: unknown }).PushManager;
        },
      ],
      [
        'Notification がない',
        () => {
          supportPush();
          delete (window as { Notification?: unknown }).Notification;
        },
      ],
    ])('%s なら unsupported', async (_label, setup) => {
      setup();
      const { result } = renderHook(() => usePush());
      await flush();
      expect(result.current.status).toBe('unsupported');
      expect(get).not.toHaveBeenCalled();
    });

    it.each([
      ['iPhone', { ua: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0)' }],
      ['iPad（Mac として名乗る）', { platform: 'MacIntel', touch: 5 }],
    ])('%s のブラウザならホーム画面への追加を案内する', async (_label, p) => {
      env(p);
      const { result } = renderHook(() => usePush());
      await flush();
      expect(result.current.status).toBe('needs-install');
    });

    it('タッチのない Mac は iOS ではない', async () => {
      env({ platform: 'MacIntel', touch: 0 });
      const { result } = renderHook(() => usePush());
      await flush();
      expect(result.current.status).toBe('unsupported');
    });

    it.each([
      ['display-mode が standalone', { standaloneMedia: true }],
      ['navigator.standalone', { standalone: true }],
    ])(
      'iOS でもホーム画面のアプリ（%s）なら unsupported',
      async (_label, p) => {
        env({ ua: 'iPhone', ...p });
        const { result } = renderHook(() => usePush());
        await flush();
        expect(result.current.status).toBe('unsupported');
      },
    );
  });
});

describe('subscribe', () => {
  beforeEach(supportPush);

  it('許可を得て、公開鍵で購読し、サーバーに登録する', async () => {
    const { result } = renderHook(() => usePush());
    await flush();
    await act(() => result.current.subscribe());

    expect(notification.requestPermission).toHaveBeenCalled();
    const opts = pushManager.subscribe.mock.calls[0][0];
    expect(opts.userVisibleOnly).toBe(true);
    // base64url（パディングなし）をバイト列にする: "BAa-_w" → 04 06 be ff
    expect([...opts.applicationServerKey]).toEqual([0x04, 0x06, 0xbe, 0xff]);
    expect(post).toHaveBeenCalledWith('/push/subscriptions', sub.toJSON());
    expect(result.current).toMatchObject({
      status: 'on',
      busy: false,
      error: null,
    });
  });

  it.each([
    ['BA', [0x04]],
    ['BAa', [0x04, 0x06]],
    ['BAa-', [0x04, 0x06, 0xbe]],
  ])('公開鍵 %s のパディングを補う', async (publicKey, bytes) => {
    get.mockResolvedValue({ enabled: true, publicKey });
    const { result } = renderHook(() => usePush());
    await flush();
    await act(() => result.current.subscribe());
    expect([
      ...pushManager.subscribe.mock.calls[0][0].applicationServerKey,
    ]).toEqual(bytes);
  });

  it('すでに購読していればそれを登録する', async () => {
    const { result } = renderHook(() => usePush());
    await flush();
    pushManager.getSubscription.mockResolvedValue(sub);
    await act(() => result.current.subscribe());
    expect(pushManager.subscribe).not.toHaveBeenCalled();
    expect(post).toHaveBeenCalled();
    expect(result.current.status).toBe('on');
  });

  it.each([
    ['denied', 'denied'],
    ['default', 'off'],
  ] as const)(
    '許可が %s なら %s のまま購読しない',
    async (permission, status) => {
      notification.requestPermission.mockResolvedValue(permission);
      const { result } = renderHook(() => usePush());
      await flush();
      await act(() => result.current.subscribe());
      expect(result.current.status).toBe(status);
      expect(pushManager.subscribe).not.toHaveBeenCalled();
    },
  );

  it('公開鍵がなければ disabled', async () => {
    const { result } = renderHook(() => usePush());
    await flush();
    get.mockResolvedValue({ enabled: false, publicKey: null });
    await act(() => result.current.subscribe());
    expect(result.current.status).toBe('disabled');
  });

  it.each([
    [new Error('登録に失敗'), '登録に失敗'],
    ['raw', 'raw'],
  ])('失敗したらエラーを持つ（%s）', async (err, text) => {
    const { result } = renderHook(() => usePush());
    await flush();
    post.mockRejectedValue(err);
    await act(() => result.current.subscribe());
    expect(result.current).toMatchObject({
      error: text,
      busy: false,
      status: 'off',
    });
  });

  it('処理中は busy', async () => {
    let grant = (_: string) => {};
    notification.requestPermission.mockReturnValue(
      new Promise((r) => {
        grant = r;
      }),
    );
    const { result } = renderHook(() => usePush());
    await flush();
    let p: Promise<void> = Promise.resolve();
    act(() => {
      p = result.current.subscribe();
    });
    expect(result.current.busy).toBe(true);
    await act(async () => {
      grant('granted');
      await p;
    });
    expect(result.current.busy).toBe(false);
  });
});

describe('unsubscribe', () => {
  beforeEach(supportPush);

  it('サーバーから消してから購読を解除する', async () => {
    pushManager.getSubscription.mockResolvedValue(sub);
    const { result } = renderHook(() => usePush());
    await flush();
    await act(() => result.current.unsubscribe());
    expect(del).toHaveBeenCalledWith('/push/subscriptions', {
      endpoint: sub.endpoint,
    });
    expect(sub.unsubscribe).toHaveBeenCalled();
    expect(result.current.status).toBe('off');
  });

  it('購読がなければ off にするだけ', async () => {
    const { result } = renderHook(() => usePush());
    await flush();
    await act(() => result.current.unsubscribe());
    expect(del).not.toHaveBeenCalled();
    expect(result.current.status).toBe('off');
  });

  it.each([
    [new Error('削除に失敗'), '削除に失敗'],
    ['raw', 'raw'],
  ])('失敗したらエラーを持つ（%s）', async (err, text) => {
    pushManager.getSubscription.mockResolvedValue(sub);
    const { result } = renderHook(() => usePush());
    await flush();
    del.mockRejectedValue(err);
    await act(() => result.current.unsubscribe());
    expect(result.current).toMatchObject({
      error: text,
      busy: false,
      status: 'on',
    });
  });
});

describe('sendTest', () => {
  beforeEach(supportPush);

  it('テスト通知を送る', async () => {
    const { result } = renderHook(() => usePush());
    await flush();
    await act(() => result.current.sendTest());
    expect(post).toHaveBeenCalledWith('/push/test');
    expect(result.current).toMatchObject({ error: null, busy: false });
  });

  it.each([
    [new Error('送信に失敗'), '送信に失敗'],
    ['raw', 'raw'],
  ])('失敗したらエラーを持つ（%s）', async (err, text) => {
    const { result } = renderHook(() => usePush());
    await flush();
    post.mockRejectedValue(err);
    await act(() => result.current.sendTest());
    expect(result.current.error).toBe(text);
  });
});
