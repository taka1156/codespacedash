import { describe, expect, it } from 'vitest';
import { CloudflareError } from './cloudflare';
import { GithubError } from './github';
import { settle, unconfigured } from './section';

describe('settle', () => {
  it('成功したら ok とデータ', async () => {
    expect(await settle(async () => [1, 2], 'P')).toEqual({
      status: 'ok',
      data: [1, 2],
    });
  });

  it.each([401, 403])(
    'GitHub の %s は権限不足として権限名を添える',
    async (status) => {
      expect(
        await settle(async () => {
          throw new GithubError(status, `GitHub API ${status}`);
        }, 'Plan: Read'),
      ).toEqual({
        status: 'forbidden',
        permission: 'Plan: Read',
        message: `GitHub API ${status}`,
      });
    },
  );

  it('Cloudflare の 403 も権限不足', async () => {
    const s = await settle(async () => {
      throw new CloudflareError(403, 'denied');
    }, 'Account Analytics: Read');
    expect(s.status).toBe('forbidden');
  });

  it('それ以外のステータスはエラー', async () => {
    expect(
      await settle(async () => {
        throw new GithubError(500, 'GitHub API 500');
      }, 'P'),
    ).toEqual({ status: 'error', message: 'GitHub API 500' });
  });

  it('API 以外の例外は 403 を持っていてもエラー', async () => {
    const e = Object.assign(new Error('fake'), { status: 403 });
    expect(
      await settle(async () => {
        throw e;
      }, 'P'),
    ).toEqual({ status: 'error', message: 'fake' });
  });

  it('Error 以外が投げられても文字列にする', async () => {
    expect(
      await settle(async () => {
        throw 'oops';
      }, 'P'),
    ).toEqual({ status: 'error', message: 'oops' });
  });
});

describe('unconfigured', () => {
  it('足りない設定名を入れる', () => {
    expect(unconfigured('CLOUDFLARE_API_TOKEN')).toEqual({
      status: 'unconfigured',
      setting: 'CLOUDFLARE_API_TOKEN',
    });
  });
});
