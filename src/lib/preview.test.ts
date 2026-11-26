import { afterEach, describe, expect, it, vi } from 'vitest';

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

describe('preview', () => {
  it('通常のビルドでは静的プレビューではない', async () => {
    vi.stubEnv('MODE', 'production');
    const { IS_STATIC_PREVIEW } = await import('./preview');
    expect(IS_STATIC_PREVIEW).toBe(false);
  });

  it('pages モードでは静的プレビュー', async () => {
    vi.stubEnv('MODE', 'pages');
    const { IS_STATIC_PREVIEW } = await import('./preview');
    expect(IS_STATIC_PREVIEW).toBe(true);
  });

  it('asset は BASE_URL の下のパスにする（先頭の / は重ねない）', async () => {
    vi.stubEnv('BASE_URL', '/codespacedash/');
    const { asset } = await import('./preview');
    expect(asset('/icons/a.png')).toBe('/codespacedash/icons/a.png');
    expect(asset('icons/a.png')).toBe('/codespacedash/icons/a.png');
  });
});
