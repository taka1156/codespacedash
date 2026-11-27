// お気に入りリポジトリの名前（owner/repo）の扱い。サーバーとクライアントで同じ規則を使う

/** 登録できる数の上限（GraphQL 1回で取るので増やしすぎない） */
export const MAX_FAVORITES = 30;

// owner は英数字とハイフン（39文字まで）、リポジトリ名は英数字と . _ -
const REPO = /^[A-Za-z0-9](?:[A-Za-z0-9-]{0,38})\/[A-Za-z0-9._-]{1,100}$/;

export const isRepoName = (v: unknown): v is string =>
  typeof v === 'string' && REPO.test(v) && !/\/\.{1,2}$/.test(v);

/**
 * 入力を owner/repo にそろえる。GitHub の URL（https://github.com/owner/repo/pulls など）や
 * 末尾の .git も受け付ける。形が違えば null
 */
export const normalizeRepo = (input: string): string | null => {
  const s = input
    .trim()
    .replace(/^(?:https?:\/\/)?(?:www\.)?github\.com\//i, '')
    .replace(/[?#].*$/, '');
  const [owner, name = ''] = s.split('/');
  const repo = `${owner}/${name.replace(/\.git$/i, '')}`;
  return isRepoName(repo) ? repo : null;
};

/** 大文字小文字を区別せずに重複を除く（最初に出てきた表記を残す） */
export const uniqueRepos = (repos: readonly string[]) => {
  const seen = new Set<string>();
  return repos.filter((r) => {
    const k = r.toLowerCase();
    if (seen.has(k)) {
      return false;
    }
    seen.add(k);
    return true;
  });
};
