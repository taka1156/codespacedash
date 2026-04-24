export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

// path例: '/user', '/user/codespaces' など
export const apiFetch = async <T = unknown>(
  path: string,
  token: string,
  apiVersion = '2022-11-28',
): Promise<T> => {
  const res = await fetch(`https://api.github.com${path}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': apiVersion,
      'User-Agent': 'github-dashboard/1.0',
    },
  });
  const json = await res.json();
  if (!res.ok) {
    throw new ApiError(res.status, json.message || `HTTP ${res.status}`);
  }
  return json as T;
};
