import {
  isRepoName,
  MAX_FAVORITES,
  normalizeRepo,
  uniqueRepos,
} from '../../shared/repos';
import type { PullRequest, PullReview, RepoPulls } from '../../shared/types';
import type { Env } from '../env';
import { GithubError, gh } from './github';

/** 1リポジトリあたりに返す PR の数（総数は totalCount で別に返す） */
export const PULLS_PER_REPO = 10;

/** クエリの repos=owner/a,owner/b を検証して配列にする。不正なら 400 */
export const parseRepoList = (raw: string | undefined): string[] => {
  const list = (raw ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  const repos = list.map(normalizeRepo);
  const bad = list.find((_, i) => repos[i] === null);
  if (bad !== undefined) {
    throw new GithubError(400, `リポジトリ名が不正です: ${bad}`);
  }
  const unique = uniqueRepos(repos as string[]);
  if (unique.length > MAX_FAVORITES) {
    throw new GithubError(
      400,
      `リポジトリは ${MAX_FAVORITES} 件までにしてください`,
    );
  }
  return unique;
};

interface RawPull {
  number: number;
  title: string;
  url: string;
  isDraft: boolean;
  createdAt: string;
  updatedAt: string;
  headRefName: string;
  reviewDecision: 'APPROVED' | 'CHANGES_REQUESTED' | 'REVIEW_REQUIRED' | null;
  author: { login: string } | null;
  comments: { totalCount: number };
}

interface RawRepo {
  nameWithOwner: string;
  url: string;
  isPrivate: boolean;
  pullRequests: { totalCount: number; nodes: RawPull[] };
}

interface GraphqlResponse {
  data?: Record<string, RawRepo | null> | null;
  errors?: { type?: string; message: string }[];
}

const REVIEW: Record<NonNullable<RawPull['reviewDecision']>, PullReview> = {
  APPROVED: 'approved',
  CHANGES_REQUESTED: 'changes_requested',
  REVIEW_REQUIRED: 'review_required',
};

const toPull = (p: RawPull): PullRequest => ({
  number: p.number,
  title: p.title,
  url: p.url,
  draft: p.isDraft,
  author: p.author?.login ?? null,
  branch: p.headRefName,
  createdAt: p.createdAt,
  updatedAt: p.updatedAt,
  review: p.reviewDecision ? REVIEW[p.reviewDecision] : null,
  comments: p.comments.totalCount,
});

const FIELDS = `
  nameWithOwner url isPrivate
  pullRequests(states: OPEN, first: ${PULLS_PER_REPO}, orderBy: {field: UPDATED_AT, direction: DESC}) {
    totalCount
    nodes {
      number title url isDraft createdAt updatedAt headRefName reviewDecision
      author { login }
      comments { totalCount }
    }
  }`;

/** リポジトリごとに別名（r0, r1, …）を付けて、1回の GraphQL で全部取る。名前は変数で渡す */
export const buildQuery = (repos: string[]) => {
  const vars: Record<string, string> = {};
  const defs: string[] = [];
  const parts = repos.map((repo, i) => {
    const [owner, name] = repo.split('/');
    vars[`o${i}`] = owner;
    vars[`n${i}`] = name;
    defs.push(`$o${i}: String!`, `$n${i}: String!`);
    return `r${i}: repository(owner: $o${i}, name: $n${i}) {${FIELDS}\n}`;
  });
  return {
    query: `query(${defs.join(', ')}) {\n${parts.join('\n')}\n}`,
    variables: vars,
  };
};

/** お気に入りリポジトリのオープンな PR（登録した順） */
export const listPullRequests = async (
  env: Env,
  repos: string[],
): Promise<RepoPulls[]> => {
  if (repos.length === 0) {
    return [];
  }
  const res = await gh<GraphqlResponse>(env, '/graphql', {
    method: 'POST',
    body: JSON.stringify(buildQuery(repos)),
  });
  // 見つからないリポジトリは NOT_FOUND のエラーと null になるだけなので、data があれば続ける
  if (!res.data) {
    const e = res.errors?.[0];
    throw new GithubError(
      e?.type === 'FORBIDDEN' ? 403 : 502,
      `GitHub GraphQL: ${e?.message ?? 'データがありません'}`,
    );
  }
  const data = res.data;
  return repos.map((repo, i): RepoPulls => {
    const r = data[`r${i}`];
    if (!r) {
      return {
        repo,
        found: false,
        url: `https://github.com/${repo}`,
        private: false,
        totalCount: 0,
        pulls: [],
      };
    }
    return {
      repo,
      found: true,
      url: r.url,
      private: r.isPrivate,
      totalCount: r.pullRequests.totalCount,
      pulls: r.pullRequests.nodes.map(toPull),
    };
  });
};

// ── 登録するときの候補（自分が見られるリポジトリ） ──

const CANDIDATES_CACHE_MS = 10 * 60_000;
let candidatesMemo: { repos: string[]; at: number } | null = null;

/** 最近 push された順に最大100件。候補を出すだけなので10分キャッシュ */
export const listRepoCandidates = async (env: Env): Promise<string[]> => {
  if (candidatesMemo && Date.now() - candidatesMemo.at < CANDIDATES_CACHE_MS) {
    return candidatesMemo.repos;
  }
  const raw = await gh<{ full_name: string; archived: boolean }[]>(
    env,
    '/user/repos?sort=pushed&direction=desc&per_page=100',
  );
  const repos = raw
    .filter((r) => !r.archived && isRepoName(r.full_name))
    .map((r) => r.full_name);
  candidatesMemo = { repos, at: Date.now() };
  return repos;
};
