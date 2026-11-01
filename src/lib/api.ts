import { CSRF_HEADER, CSRF_VALUE } from '../../shared/types';

// ブラウザは GitHub API を直接叩かない。自分の Worker(/api) が返す JSON だけを扱う。

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

/** Cloudflare Access のセッションが切れたとき（ログイン画面へのリダイレクト） */
export class SessionExpiredError extends ApiError {
  constructor() {
    super(
      401,
      'セッションが切れました。再読み込みしてログインし直してください',
    );
  }
}

const request = async <T>(path: string, init: RequestInit = {}) => {
  const res = await fetch(`/api${path}`, {
    ...init,
    credentials: 'same-origin',
    // Access の期限切れはログイン画面への 302 になる。追従すると CORS エラーで原因が分からないので止める
    redirect: 'manual',
    headers: {
      ...(init.body ? { 'Content-Type': 'application/json' } : {}),
      [CSRF_HEADER]: CSRF_VALUE,
      ...init.headers,
    },
  });

  if (res.type === 'opaqueredirect' || res.status === 401) {
    throw new SessionExpiredError();
  }

  const body = (await res.json().catch(() => null)) as
    | (T & { error?: string })
    | null;
  if (!res.ok) {
    throw new ApiError(res.status, body?.error ?? `HTTP ${res.status}`);
  }
  return body as T;
};

export const api = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, body?: unknown) =>
    request<T>(path, {
      method: 'POST',
      body: body === undefined ? undefined : JSON.stringify(body),
    }),
  delete: <T>(path: string, body?: unknown) =>
    request<T>(path, {
      method: 'DELETE',
      body: body === undefined ? undefined : JSON.stringify(body),
    }),
};
