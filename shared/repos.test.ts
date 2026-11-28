import { describe, expect, it } from 'vitest';
import { isRepoName, normalizeRepo, uniqueRepos } from './repos';

describe('isRepoName', () => {
  it('owner/repo の形だけを受け付ける', () => {
    expect(isRepoName('taka1156/quotadash')).toBe(true);
    expect(isRepoName('my-org/repo.name_2')).toBe(true);
    expect(isRepoName('a/b')).toBe(true);
  });

  it('形が違うもの・文字列以外は弾く', () => {
    for (const v of [
      '',
      'quotadash',
      'a/b/c',
      '-owner/repo',
      'owner/',
      '/repo',
      'own er/repo',
      'owner/re po',
      `${'a'.repeat(40)}/repo`,
      'owner/.',
      'owner/..',
      123,
      null,
    ]) {
      expect(isRepoName(v)).toBe(false);
    }
  });

  it('owner は 39文字、リポジトリ名は 100文字まで', () => {
    expect(isRepoName(`${'a'.repeat(39)}/repo`)).toBe(true);
    expect(isRepoName(`${'a'.repeat(40)}/repo`)).toBe(false);
    expect(isRepoName(`owner/${'r'.repeat(100)}`)).toBe(true);
    expect(isRepoName(`owner/${'r'.repeat(101)}`)).toBe(false);
  });

  it('. で始まるだけのリポジトリ名は受け付ける', () => {
    expect(isRepoName('owner/.github')).toBe(true);
  });
});

describe('normalizeRepo', () => {
  it('前後の空白を除く', () => {
    expect(normalizeRepo('  owner/repo \n')).toBe('owner/repo');
  });

  it('GitHub の URL から owner/repo を取り出す', () => {
    expect(normalizeRepo('https://github.com/owner/repo')).toBe('owner/repo');
    expect(normalizeRepo('http://www.github.com/owner/repo/pulls')).toBe(
      'owner/repo',
    );
    expect(normalizeRepo('github.com/owner/repo?tab=readme#top')).toBe(
      'owner/repo',
    );
    expect(normalizeRepo('https://github.com/owner/repo.git')).toBe(
      'owner/repo',
    );
  });

  it('形にならなければ null', () => {
    expect(normalizeRepo('')).toBeNull();
    expect(normalizeRepo('owner')).toBeNull();
    expect(normalizeRepo('https://example.com/owner/repo')).toBeNull();
  });
});

describe('uniqueRepos', () => {
  it('大文字小文字を区別せずに重複を除き、最初の表記を残す', () => {
    expect(uniqueRepos(['Owner/Repo', 'b/c', 'owner/repo'])).toEqual([
      'Owner/Repo',
      'b/c',
    ]);
  });
});
