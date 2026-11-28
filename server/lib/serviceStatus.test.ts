import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ComponentStatus } from '../../shared/types';
import { json } from '../testing/fakeEnv';

// 5分のキャッシュをモジュール内に持つので、テストごとに読み直す
const load = () => import('./serviceStatus');

const NOW = new Date('2026-11-27T05:00:00Z');
const fetchMock = vi.fn<typeof fetch>();

const component = (
  id: string,
  name: string,
  status: 'operational' | ComponentStatus,
  p: Record<string, unknown> = {},
) => ({ id, name, status, ...p });

const summaries = (r: { github?: unknown; cloudflare?: unknown }) =>
  fetchMock.mockImplementation(async (input) => {
    const url = String(input);
    const body = url.startsWith('https://www.githubstatus.com/')
      ? r.github
      : r.cloudflare;
    return body instanceof Response ? body : json(body ?? {});
  });

beforeEach(() => {
  vi.resetModules();
  vi.useFakeTimers({ now: NOW, toFake: ['Date'] });
  fetchMock.mockReset();
  vi.stubGlobal('fetch', fetchMock);
  vi.spyOn(console, 'warn').mockImplementation(() => {});
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('toIssues', () => {
  it('見ているコンポーネントのうち正常でないものに、関係する障害とメンテナンスを添える', async () => {
    const { toIssues } = await load();
    expect(
      toIssues('github', {
        components: [
          component('g', 'Git Operations', 'major_outage'),
          component('a', 'Actions', 'degraded_performance'),
          component('c', 'Copilot', 'operational'),
          component('grp', 'Codespaces', 'partial_outage', { group: true }),
          component('cs', 'Codespaces', 'under_maintenance'),
          // 同じ名前が重なっていたら最初の1つだけ
          component('a2', 'Actions', 'major_outage'),
        ],
        incidents: [
          {
            id: 'i1',
            name: 'Delays in Actions',
            shortlink: 'https://stspg.io/x',
            components: [{ id: 'a' }, { id: 'g' }],
          },
          { id: 'i2', name: 'Unrelated', components: [{ id: 'g' }] },
          { id: 'i3', name: 'No components' },
        ],
        scheduled_maintenances: [
          {
            id: 'm1',
            name: 'Codespaces maintenance',
            shortlink: null,
            components: [{ id: 'cs' }],
          },
        ],
      }),
    ).toEqual([
      {
        component: 'Actions',
        status: 'degraded_performance',
        incidents: [
          { id: 'i1', name: 'Delays in Actions', url: 'https://stspg.io/x' },
        ],
      },
      {
        component: 'Codespaces',
        status: 'under_maintenance',
        incidents: [
          {
            id: 'm1',
            name: 'Codespaces maintenance',
            url: 'https://www.githubstatus.com/incidents/m1',
          },
        ],
      },
    ]);
  });

  it('項目が欠けていても空として扱う', async () => {
    const { toIssues } = await load();
    expect(toIssues('cloudflare', {})).toEqual([]);
    expect(
      toIssues('cloudflare', {
        components: [component('w', 'Workers', 'partial_outage')],
      }),
    ).toEqual([
      { component: 'Workers', status: 'partial_outage', incidents: [] },
    ]);
  });
});

describe('getServiceStatus', () => {
  it('両方の summary.json を連絡先つきの User-Agent で取り、5分はキャッシュする', async () => {
    summaries({
      github: { components: [component('a', 'Actions', 'major_outage')] },
      cloudflare: {
        components: [component('b', 'Workers Builds', 'degraded_performance')],
      },
    });
    const { getServiceStatus } = await load();
    const first = await getServiceStatus();
    expect(first.github.map((i) => i.component)).toEqual(['Actions']);
    expect(first.cloudflare.map((i) => i.component)).toEqual([
      'Workers Builds',
    ]);
    expect(fetchMock.mock.calls.map((c) => c[0])).toEqual([
      'https://www.githubstatus.com/api/v2/summary.json',
      'https://www.cloudflarestatus.com/api/v2/summary.json',
    ]);
    expect(fetchMock.mock.calls[0][1]?.headers).toMatchObject({
      'User-Agent': expect.stringContaining('github.com/taka1156/quotadash'),
    });

    vi.setSystemTime(new Date(NOW.getTime() + 4 * 60_000));
    expect(await getServiceStatus()).toEqual(first);
    expect(fetchMock).toHaveBeenCalledTimes(2);

    vi.setSystemTime(new Date(NOW.getTime() + 6 * 60_000));
    await getServiceStatus();
    expect(fetchMock).toHaveBeenCalledTimes(4);
  });

  it('取れなかったサービスは空にして、もう片方は返す', async () => {
    summaries({
      github: new Response('down', { status: 503 }),
      cloudflare: { components: [component('w', 'Workers', 'major_outage')] },
    });
    const { getServiceStatus } = await load();
    const out = await getServiceStatus();
    expect(out.github).toEqual([]);
    expect(out.cloudflare).toHaveLength(1);
    expect(console.warn).toHaveBeenCalledWith(
      'service status unavailable',
      'github',
      new Error('GitHub Status 503'),
    );
  });

  it('通信できなくても空にする', async () => {
    fetchMock.mockRejectedValue(new TypeError('network'));
    const { getServiceStatus } = await load();
    expect(await getServiceStatus()).toEqual({ github: [], cloudflare: [] });
  });
});
