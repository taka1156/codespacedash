import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { parseRoute, routeHref, useRoute } from './useRoute';

beforeEach(() => {
  location.hash = '';
});

describe('parseRoute', () => {
  it.each([
    ['', { page: 'dashboard' }],
    ['#/', { page: 'dashboard' }],
    ['#/unknown', { page: 'dashboard' }],
    ['#/settings', { page: 'settings', section: 'plans' }],
    ['#/settings/tokens', { page: 'settings', section: 'tokens' }],
    ['#settings/debug', { page: 'settings', section: 'debug' }],
    ['#/settings/nope', { page: 'settings', section: 'plans' }],
  ])('%s', (hash, route) => {
    expect(parseRoute(hash)).toEqual(route);
  });
});

describe('routeHref', () => {
  it('ハッシュの URL にする', () => {
    expect(routeHref({ page: 'dashboard' })).toBe('#/');
    expect(routeHref({ page: 'settings', section: 'favorites' })).toBe(
      '#/settings/favorites',
    );
  });
});

describe('useRoute', () => {
  it('今のハッシュから始め、移動するとハッシュを変えて先頭に戻す', async () => {
    location.hash = '#/settings/tokens';
    const scroll = vi.spyOn(window, 'scrollTo').mockImplementation(() => {});
    const { result } = renderHook(() => useRoute());
    expect(result.current.route).toEqual({
      page: 'settings',
      section: 'tokens',
    });

    await act(async () => {
      result.current.navigate({ page: 'dashboard' });
      await new Promise((r) => setTimeout(r, 0));
    });
    expect(location.hash).toBe('#/');
    expect(result.current.route).toEqual({ page: 'dashboard' });
    expect(scroll).toHaveBeenCalledWith(0, 0);
  });

  it('外したらハッシュの変化を見ない', () => {
    const remove = vi.spyOn(window, 'removeEventListener');
    const { unmount } = renderHook(() => useRoute());
    unmount();
    expect(remove).toHaveBeenCalledWith('hashchange', expect.any(Function));
  });
});
