import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ServiceStatus } from '../../shared/types';
import { fakeEnv, PUSH_VARS } from '../testing/fakeEnv';
import { sendToAll } from './push';
import { getServiceStatus } from './serviceStatus';
import { checkServiceStatus } from './statusNotify';

vi.mock('./serviceStatus', () => ({ getServiceStatus: vi.fn() }));
vi.mock('./push', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./push')>()),
  sendToAll: vi.fn(async () => ({ sent: 1, failed: 0, removed: 0 })),
}));

const CF = { CLOUDFLARE_API_TOKEN: 't', CLOUDFLARE_ACCOUNT_ID: 'a' };
const incident = (id: string, name: string) => ({
  id,
  name,
  url: `https://stspg.io/${id}`,
});

const status = (s: Partial<ServiceStatus>) =>
  vi.mocked(getServiceStatus).mockResolvedValue({
    github: [],
    cloudflare: [],
    ...s,
  });

beforeEach(() => {
  vi.spyOn(console, 'log').mockImplementation(() => {});
  vi.mocked(sendToAll).mockClear();
  vi.mocked(getServiceStatus).mockReset();
});

describe('checkServiceStatus', () => {
  it('プッシュ通知が未設定なら何もしない', async () => {
    await checkServiceStatus(fakeEnv());
    expect(getServiceStatus).not.toHaveBeenCalled();
  });

  it('新しい障害をサービスごとにまとめて通知し、1日は同じものを通知しない', async () => {
    status({
      github: [
        {
          component: 'Actions',
          status: 'degraded_performance',
          incidents: [incident('i1', 'Delays in Actions')],
        },
        { component: 'Copilot', status: 'major_outage', incidents: [] },
      ],
    });
    const env = fakeEnv(PUSH_VARS);
    await checkServiceStatus(env);
    expect(sendToAll).toHaveBeenCalledWith(env, {
      title: 'GitHub で障害が発生中',
      body: '性能低下：Actions — Delays in Actions\n全面障害：Copilot',
      url: 'https://stspg.io/i1',
      tag: 'status-github',
    });
    expect(env.KV.puts.map((p) => [p.key, p.options])).toEqual([
      [
        'status-notified:github:Actions:degraded_performance:i1',
        { expirationTtl: 86_280 },
      ],
      [
        'status-notified:github:Copilot:major_outage:',
        { expirationTtl: 86_280 },
      ],
    ]);

    await checkServiceStatus(env);
    expect(sendToAll).toHaveBeenCalledTimes(1);
  });

  it('状態が変われば通知し、障害のページがなければステータスページを開く', async () => {
    const env = fakeEnv(PUSH_VARS);
    await env.KV.put(
      'status-notified:github:Copilot:degraded_performance:',
      '1',
    );
    status({
      github: [
        { component: 'Copilot', status: 'degraded_performance', incidents: [] },
        { component: 'Actions', status: 'partial_outage', incidents: [] },
      ],
    });
    await checkServiceStatus(env);
    expect(vi.mocked(sendToAll).mock.calls[0][1]).toMatchObject({
      body: '一部障害：Actions',
      url: 'https://www.githubstatus.com',
    });
  });

  it('障害がなければ通知しない', async () => {
    status({});
    await checkServiceStatus(fakeEnv({ ...PUSH_VARS, ...CF }));
    expect(sendToAll).not.toHaveBeenCalled();
  });

  it('Cloudflare は設定されているときだけ通知する', async () => {
    const cloudflare = [
      { component: 'Workers', status: 'major_outage' as const, incidents: [] },
    ];
    status({ cloudflare });
    await checkServiceStatus(fakeEnv(PUSH_VARS));
    expect(sendToAll).not.toHaveBeenCalled();

    await checkServiceStatus(fakeEnv({ ...PUSH_VARS, ...CF }));
    expect(vi.mocked(sendToAll).mock.calls[0][1]).toMatchObject({
      title: 'Cloudflare で障害が発生中',
      tag: 'status-cloudflare',
      url: 'https://www.cloudflarestatus.com',
    });
  });
});
