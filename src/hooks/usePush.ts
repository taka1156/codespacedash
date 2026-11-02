import { useCallback, useEffect, useState } from 'react';
import { api } from '@/lib/api';
import type { PushConfigResponse } from '@/lib/types';

export type PushStatus =
  | 'loading'
  | 'unsupported' // ブラウザ非対応
  | 'needs-install' // iOS: ホーム画面に追加したPWAでないと購読できない
  | 'disabled' // サーバー側でVAPID未設定
  | 'denied' // ユーザーがブロック
  | 'off'
  | 'on';

const isIOS = () =>
  /iPad|iPhone|iPod/.test(navigator.userAgent) ||
  (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

const isStandalone = () =>
  window.matchMedia('(display-mode: standalone)').matches ||
  (navigator as Navigator & { standalone?: boolean }).standalone === true;

const urlBase64ToUint8Array = (base64: string) => {
  const padded = (base64 + '='.repeat((4 - (base64.length % 4)) % 4))
    .replace(/-/g, '+')
    .replace(/_/g, '/');
  const raw = atob(padded);
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
};

export const usePush = () => {
  const [status, setStatus] = useState<PushStatus>('loading');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    const supported =
      'serviceWorker' in navigator &&
      'PushManager' in window &&
      'Notification' in window;
    if (!supported) {
      setStatus(isIOS() && !isStandalone() ? 'needs-install' : 'unsupported');
      return;
    }
    try {
      const config = await api.get<PushConfigResponse>('/push/config');
      if (!config.enabled) {
        setStatus('disabled');
        return;
      }
      if (Notification.permission === 'denied') {
        setStatus('denied');
        return;
      }
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      setStatus(sub ? 'on' : 'off');
    } catch {
      setStatus('unsupported');
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const subscribe = useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') {
        setStatus(permission === 'denied' ? 'denied' : 'off');
        return;
      }
      const { publicKey } = await api.get<PushConfigResponse>('/push/config');
      if (!publicKey) {
        setStatus('disabled');
        return;
      }
      const reg = await navigator.serviceWorker.ready;
      const sub =
        (await reg.pushManager.getSubscription()) ??
        (await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(publicKey),
        }));
      await api.post('/push/subscriptions', sub.toJSON());
      setStatus('on');
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }, []);

  const unsubscribe = useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (sub) {
        await api.delete('/push/subscriptions', { endpoint: sub.endpoint });
        await sub.unsubscribe();
      }
      setStatus('off');
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }, []);

  const sendTest = useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      await api.post('/push/test');
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }, []);

  return { status, busy, error, subscribe, unsubscribe, sendTest };
};
