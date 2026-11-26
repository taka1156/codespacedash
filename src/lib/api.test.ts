import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CSRF_HEADER, CSRF_VALUE } from '../../shared/types';
import { ApiError, api, SessionExpiredError } from './api';

const fetchMock = vi.fn<typeof fetch>();

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal('fetch', fetchMock);
});

const lastInit = () => fetchMock.mock.calls[0][1] as RequestInit;

describe('api', () => {
  it('GET は /api を前に付け、CSRF ヘッダーを付けてリダイレクトを追わない', async () => {
    fetchMock.mockResolvedValue(json({ ok: 1 }));
    expect(await api.get('/dashboard')).toEqual({ ok: 1 });
    expect(fetchMock.mock.calls[0][0]).toBe('/api/dashboard');
    expect(lastInit()).toMatchObject({
      credentials: 'same-origin',
      redirect: 'manual',
      headers: { [CSRF_HEADER]: CSRF_VALUE },
    });
    // body がなければ Content-Type は付けない
    expect(lastInit().headers).not.toHaveProperty('Content-Type');
  });

  it('POST は body を JSON にして Content-Type を付ける', async () => {
    fetchMock.mockResolvedValue(json({ ok: true }, 201));
    await api.post('/push/subscriptions', { a: 1 });
    expect(lastInit()).toMatchObject({
      method: 'POST',
      body: '{"a":1}',
      headers: { 'Content-Type': 'application/json' },
    });
  });

  it('POST は body を省略できる', async () => {
    fetchMock.mockResolvedValue(json({ ok: true }));
    await api.post('/push/test');
    expect(lastInit().body).toBeUndefined();
  });

  it('DELETE も body あり・なしで送れる', async () => {
    fetchMock.mockResolvedValue(json({ ok: true }));
    await api.delete('/push/subscriptions', { endpoint: 'e' });
    expect(lastInit()).toMatchObject({
      method: 'DELETE',
      body: '{"endpoint":"e"}',
    });

    fetchMock.mockResolvedValue(json({ ok: true }));
    await api.delete('/x');
    expect(fetchMock.mock.calls[1][1]?.body).toBeUndefined();
  });

  it('Access のリダイレクトはセッション切れ', async () => {
    const res = new Response(null, { status: 200 });
    Object.defineProperty(res, 'type', { value: 'opaqueredirect' });
    fetchMock.mockResolvedValue(res);
    await expect(api.get('/dashboard')).rejects.toBeInstanceOf(
      SessionExpiredError,
    );
  });

  it('401 もセッション切れ', async () => {
    fetchMock.mockResolvedValue(json({ error: 'x' }, 401));
    const e = await api.get('/dashboard').catch((e: unknown) => e);
    expect(e).toBeInstanceOf(SessionExpiredError);
    expect(e).toBeInstanceOf(ApiError);
    expect((e as ApiError).status).toBe(401);
  });

  it('エラー応答は error の文言とステータスを持つ', async () => {
    fetchMock.mockResolvedValue(json({ error: 'GitHub API 502' }, 502));
    await expect(api.get('/dashboard')).rejects.toMatchObject({
      status: 502,
      message: 'GitHub API 502',
    });
  });

  it('JSON でないエラー応答は HTTP ステータスを文言にする', async () => {
    fetchMock.mockResolvedValue(new Response('<html>', { status: 500 }));
    await expect(api.get('/dashboard')).rejects.toMatchObject({
      status: 500,
      message: 'HTTP 500',
    });
  });

  it('error のない JSON のエラー応答も HTTP ステータスを文言にする', async () => {
    fetchMock.mockResolvedValue(json({}, 400));
    await expect(api.get('/x')).rejects.toThrow('HTTP 400');
  });
});
