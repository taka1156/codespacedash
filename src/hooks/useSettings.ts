import { useCallback, useState } from 'react';
import {
  COPILOT_PLAN_KEYS,
  type CopilotPlan,
  GITHUB_PLAN_KEYS,
  type GithubPlan,
  WORKERS_PLAN_KEYS,
  type WorkersPlan,
} from '@/lib/plans';
import { IS_STATIC_PREVIEW } from '@/lib/preview';
import { isRepoName, MAX_FAVORITES, uniqueRepos } from '../../shared/repos';

const KEY = 'codespacedash:settings';

/** GitHub / Cloudflare / PR のどのタブを表示するか */
export type ServiceTab = 'github' | 'cloudflare' | 'pulls';
const SERVICE_TABS: readonly ServiceTab[] = ['github', 'cloudflare', 'pulls'];

/** 静的プレビューで最初から入れておくお気に入り（疑似データの PR が出る） */
export const PREVIEW_FAVORITES = [
  'example/web-app',
  'example/api-server',
  'example/docs-site',
];

/** デバッグ：全項目を「取れなかった」状態にして見た目を確かめる */
export type DebugSectionState = '' | 'unconfigured' | 'forbidden' | 'error';
export const DEBUG_SECTION_STATES: readonly DebugSectionState[] = [
  '',
  'unconfigured',
  'forbidden',
  'error',
];

export interface DebugSettings {
  enabled: boolean;
  sectionState: DebugSectionState;
  githubPlan: GithubPlan | '';
  copilotPlan: CopilotPlan | '';
  workersPlan: WorkersPlan | '';
  codespacesHours: string;
  codespacesStorageGb: string;
  actionsMinutes: string;
  workersMinutes: string;
  copilotUsd: string;
  /** GitHub トークンの期限までの日数（期限の警告を確かめる） */
  githubTokenDays: string;
}

export interface Settings {
  githubPlan: GithubPlan | 'auto';
  copilotPlan: CopilotPlan;
  workersPlan: WorkersPlan | 'auto';
  serviceTab: ServiceTab;
  /** PR タブに出すリポジトリ（owner/repo、登録した順） */
  favorites: string[];
  debug: DebugSettings;
}

export const EMPTY_DEBUG: DebugSettings = {
  enabled: false,
  sectionState: '',
  githubPlan: '',
  copilotPlan: '',
  workersPlan: '',
  codespacesHours: '',
  codespacesStorageGb: '',
  actionsMinutes: '',
  workersMinutes: '',
  copilotUsd: '',
  githubTokenDays: '',
};

export const SAMPLE_DEBUG: Partial<DebugSettings> = {
  codespacesHours: '48',
  codespacesStorageGb: '11.5',
  actionsMinutes: '1650',
  workersMinutes: '1280',
  copilotUsd: '7.4',
  githubTokenDays: '5',
};

const DEFAULTS: Settings = {
  githubPlan: 'auto',
  copilotPlan: 'pro',
  workersPlan: 'auto',
  serviceTab: 'github',
  favorites: IS_STATIC_PREVIEW ? PREVIEW_FAVORITES : [],
  debug: IS_STATIC_PREVIEW
    ? { ...EMPTY_DEBUG, ...SAMPLE_DEBUG, enabled: true }
    : EMPTY_DEBUG,
};

const pick = <T extends string>(
  v: unknown,
  allowed: readonly T[],
  fallback: T,
): T => (allowed.includes(v as T) ? (v as T) : fallback);

const str = (v: unknown) => (typeof v === 'string' ? v : '');

/** 形の正しい名前だけを、重複なしで上限まで残す */
const favoritesOf = (v: unknown): string[] =>
  Array.isArray(v)
    ? uniqueRepos(v.filter(isRepoName)).slice(0, MAX_FAVORITES)
    : IS_STATIC_PREVIEW
      ? PREVIEW_FAVORITES
      : [];

const load = (): Settings => {
  try {
    const stored = localStorage.getItem(KEY);
    if (!stored) {
      return DEFAULTS;
    }
    const raw = JSON.parse(stored) as Record<string, unknown>;
    const d = (raw.debug ?? {}) as Record<string, unknown>;
    return {
      githubPlan: pick<GithubPlan | 'auto'>(
        raw.githubPlan,
        ['auto', ...GITHUB_PLAN_KEYS],
        DEFAULTS.githubPlan,
      ),
      copilotPlan: pick(
        raw.copilotPlan,
        COPILOT_PLAN_KEYS,
        DEFAULTS.copilotPlan,
      ),
      workersPlan: pick<WorkersPlan | 'auto'>(
        raw.workersPlan,
        ['auto', ...WORKERS_PLAN_KEYS],
        DEFAULTS.workersPlan,
      ),
      // 古い版の aiProvider / claudePlan / buildsTab は読まずに捨てる
      serviceTab: pick(raw.serviceTab, SERVICE_TABS, DEFAULTS.serviceTab),
      favorites: favoritesOf(raw.favorites),
      debug: {
        enabled: IS_STATIC_PREVIEW || d.enabled === true,
        sectionState: pick(d.sectionState, DEBUG_SECTION_STATES, ''),
        githubPlan: pick<GithubPlan | ''>(
          d.githubPlan,
          ['', ...GITHUB_PLAN_KEYS],
          '',
        ),
        copilotPlan: pick<CopilotPlan | ''>(
          d.copilotPlan,
          ['', ...COPILOT_PLAN_KEYS],
          '',
        ),
        workersPlan: pick<WorkersPlan | ''>(
          d.workersPlan,
          ['', ...WORKERS_PLAN_KEYS],
          '',
        ),
        codespacesHours: str(d.codespacesHours),
        codespacesStorageGb: str(d.codespacesStorageGb),
        actionsMinutes: str(d.actionsMinutes),
        workersMinutes: str(d.workersMinutes),
        copilotUsd: str(d.copilotUsd),
        githubTokenDays: str(d.githubTokenDays),
      },
    };
  } catch {
    return DEFAULTS;
  }
};

const save = (s: Settings) => {
  try {
    localStorage.setItem(KEY, JSON.stringify(s));
  } catch {}
};

export const useSettings = () => {
  const [settings, setState] = useState<Settings>(load);

  const update = useCallback((patch: Partial<Settings>) => {
    setState((prev) => {
      const next = { ...prev, ...patch };
      save(next);
      return next;
    });
  }, []);

  const updateDebug = useCallback((patch: Partial<DebugSettings>) => {
    setState((prev) => {
      const debug = { ...prev.debug, ...patch };
      if (IS_STATIC_PREVIEW) {
        debug.enabled = true;
      }
      const next = { ...prev, debug };
      save(next);
      return next;
    });
  }, []);

  return { settings, update, updateDebug };
};
