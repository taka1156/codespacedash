import { describe, expect, it } from 'vitest';
import { dashboard, NOW } from '@/testing/fixtures';
import { tokenAlerts, type tokenStatus } from './tokens';

const now = NOW.getTime();
const inDays = (d: number) => new Date(now + d * 86_400_000).toISOString();
const ok = (expiresAt: string | null) => ({
  status: 'ok' as const,
  data: { expiresAt },
});

describe('tokenAlerts', () => {
  it('データがなければ何もない', () => {
    expect(tokenAlerts(null)).toEqual([]);
  });

  it('期限が近い・切れた・無効なものだけを GitHub → Cloudflare の順に返す', () => {
    const alerts = (
      github: Parameters<typeof tokenStatus>[0],
      cloudflare: Parameters<typeof tokenStatus>[0],
    ) =>
      tokenAlerts(dashboard({ tokens: { github, cloudflare } }), now).map(
        (a) => [a.key, a.level],
      );
    expect(alerts(ok(inDays(3)), ok(inDays(-1)))).toEqual([
      ['github', 'warn'],
      ['cloudflare', 'expired'],
    ]);
    expect(
      alerts(ok(inDays(30)), {
        status: 'forbidden',
        permission: '',
        message: '',
      }),
    ).toEqual([['cloudflare', 'invalid']]);
    expect(alerts(ok(null), { status: 'error', message: 'x' })).toEqual([]);
    expect(
      alerts(ok(inDays(30)), { status: 'unconfigured', setting: 'x' }),
    ).toEqual([]);
  });
});
