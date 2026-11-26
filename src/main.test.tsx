import { act, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { setPreview } from '@/testing/previewMock';

vi.mock('@/lib/preview', () =>
  import('@/testing/previewMock').then((m) => m.previewModule),
);
vi.mock('./App', () => ({ default: () => <p>app</p> }));

const register = vi.fn();

/** main.tsx は読み込んだときに動くので、毎回読み直す */
const boot = async () => {
  vi.resetModules();
  await act(() => import('./main'));
};

beforeEach(() => {
  document.body.innerHTML = '<div id="root"></div>';
  register.mockReset().mockResolvedValue({});
  Object.defineProperty(navigator, 'serviceWorker', {
    configurable: true,
    value: { register },
  });
});
afterEach(() => {
  delete (navigator as { serviceWorker?: unknown }).serviceWorker;
  document.body.innerHTML = '';
});

describe('main', () => {
  it('#root に App を描き、Service Worker を登録する', async () => {
    await boot();
    expect(screen.getByText('app')).toBeInTheDocument();
    expect(register).toHaveBeenCalledWith('/sw.js');
  });

  it('Service Worker の登録に失敗しても表示は続ける', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const err = new Error('SecurityError');
    register.mockRejectedValue(err);
    await boot();
    expect(screen.getByText('app')).toBeInTheDocument();
    expect(warn).toHaveBeenCalledWith(
      'Service Worker registration failed',
      err,
    );
  });

  it('Service Worker に対応していなければ登録しない', async () => {
    delete (navigator as { serviceWorker?: unknown }).serviceWorker;
    await boot();
    expect(screen.getByText('app')).toBeInTheDocument();
  });

  it('静的プレビューでは登録しない', async () => {
    setPreview(true);
    await boot();
    expect(register).not.toHaveBeenCalled();
  });

  it('#root がなければエラー', async () => {
    document.body.innerHTML = '';
    vi.resetModules();
    await expect(import('./main')).rejects.toThrow('Root container not found');
  });
});
