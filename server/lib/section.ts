import type { SectionState } from '../../shared/types';
import { CloudflareError } from './cloudflare';
import { GithubError } from './github';

const messageOf = (e: unknown) => (e instanceof Error ? e.message : String(e));

/**
 * 1項目ぶんの取得を SectionState にする。
 * 401/403 は「権限不足」として、足りない権限名を添えて返す（他の項目は表示を続けられる）
 */
export const settle = async <T>(
  fetcher: () => Promise<T>,
  permission: string,
): Promise<SectionState<T>> => {
  try {
    return { status: 'ok', data: await fetcher() };
  } catch (e) {
    if (
      (e instanceof GithubError || e instanceof CloudflareError) &&
      (e.status === 401 || e.status === 403)
    ) {
      return { status: 'forbidden', permission, message: messageOf(e) };
    }
    return { status: 'error', message: messageOf(e) };
  }
};

export const unconfigured = <T>(setting: string): SectionState<T> => ({
  status: 'unconfigured',
  setting,
});
