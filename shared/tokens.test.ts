import { describe, expect, it } from 'vitest';
import { alertText, needsAttention, tokenStatus } from './tokens';

const now = new Date('2026-11-27T05:00:00Z').getTime();
const inDays = (d: number) => new Date(now + d * 86_400_000).toISOString();
const ok = (expiresAt: string | null) => ({
  status: 'ok' as const,
  data: { expiresAt },
});

describe('tokenStatus', () => {
  it('14日より先なら有効', () => {
    expect(tokenStatus(ok(inDays(15)), now)).toEqual({
      level: 'ok',
      expiresAt: inDays(15),
      daysLeft: 15,
      message: null,
    });
  });

  it('14日以内なら警告（日数は切り上げ）', () => {
    expect(tokenStatus(ok(inDays(14)), now)).toMatchObject({
      level: 'warn',
      daysLeft: 14,
    });
    expect(tokenStatus(ok(inDays(0.1)), now)).toMatchObject({
      level: 'warn',
      daysLeft: 1,
    });
  });

  it('期限を過ぎたら期限切れ', () => {
    expect(tokenStatus(ok(inDays(0)), now).level).toBe('expired');
    expect(tokenStatus(ok(inDays(-3)), now).level).toBe('expired');
  });

  it('期限がなければ無期限', () => {
    expect(tokenStatus(ok(null), now)).toEqual({
      level: 'never',
      expiresAt: null,
      daysLeft: null,
      message: null,
    });
  });

  it('既定は今の時刻で判定する', () => {
    expect(tokenStatus(ok(inDays(10_000))).level).toBe('ok');
  });

  it('未設定・無効・エラーは理由を添える', () => {
    expect(
      tokenStatus({ status: 'unconfigured', setting: 'CLOUDFLARE_API_TOKEN' }),
    ).toEqual({
      level: 'unconfigured',
      expiresAt: null,
      daysLeft: null,
      message: 'CLOUDFLARE_API_TOKEN が未設定です',
    });
    expect(
      tokenStatus({ status: 'forbidden', permission: 'p', message: 'denied' }),
    ).toMatchObject({ level: 'invalid', message: 'denied' });
    expect(tokenStatus({ status: 'error', message: 'boom' })).toMatchObject({
      level: 'error',
      message: 'boom',
    });
  });
});

describe('needsAttention', () => {
  it('期限が近い・切れた・無効だけが対象', () => {
    const at = (level: Parameters<typeof needsAttention>[0]['level']) =>
      needsAttention({ level, expiresAt: null, daysLeft: null, message: null });
    expect(
      (
        [
          'ok',
          'warn',
          'expired',
          'never',
          'unconfigured',
          'invalid',
          'error',
        ] as const
      ).filter(at),
    ).toEqual(['warn', 'expired', 'invalid']);
  });
});

describe('alertText', () => {
  const text = (level: 'warn' | 'expired' | 'invalid', key = 'github') =>
    alertText({
      key: key as 'github',
      level,
      expiresAt: null,
      daysLeft: 3,
      message: null,
    });

  it('状態ごとの文言', () => {
    expect(text('warn')).toBe(
      'GitHub のトークンがあと 3 日で期限切れになります',
    );
    expect(text('expired', 'cloudflare')).toBe(
      'Cloudflare のトークンの期限が切れています',
    );
    expect(text('invalid')).toBe('GitHub のトークンが無効です');
  });
});
