import { useCallback, useState } from 'react';
import {
  CLAUDE_PLAN_KEYS,
  type ClaudePlan,
  COPILOT_PLAN_KEYS,
  type CopilotPlan,
  GITHUB_PLAN_KEYS,
  type GithubPlan,
} from '@/lib/plans';
import { IS_STATIC_PREVIEW } from '@/lib/preview';
import type { AiProvider } from '@/lib/types';
import { AI_PROVIDERS } from '../../shared/types';

const KEY = 'codespacedash:settings';

export interface DebugSettings {
  enabled: boolean;
  githubPlan: GithubPlan | '';
  copilotPlan: CopilotPlan | '';
  claudePlan: ClaudePlan | '';
  codespacesHours: string;
  actionsMinutes: string;
  copilotUsd: string;
  claudeUsd: string;
  claudeTokensM: string;
}

export interface Settings {
  aiProvider: AiProvider;
  githubPlan: GithubPlan | 'auto';
  copilotPlan: CopilotPlan;
  claudePlan: ClaudePlan;
  debug: DebugSettings;
}

export const EMPTY_DEBUG: DebugSettings = {
  enabled: false,
  githubPlan: '',
  copilotPlan: '',
  claudePlan: '',
  codespacesHours: '',
  actionsMinutes: '',
  copilotUsd: '',
  claudeUsd: '',
  claudeTokensM: '',
};

export const SAMPLE_DEBUG: Partial<DebugSettings> = {
  codespacesHours: '48',
  actionsMinutes: '1650',
  copilotUsd: '7.4',
  claudeUsd: '63.2',
  claudeTokensM: '182',
};

const DEFAULTS: Settings = {
  aiProvider: 'copilot',
  githubPlan: 'auto',
  copilotPlan: 'pro',
  claudePlan: 'api',
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

const load = (): Settings => {
  try {
    const stored = localStorage.getItem(KEY);
    if (!stored) {
      return DEFAULTS;
    }
    const raw = JSON.parse(stored) as Record<string, unknown>;
    const d = (raw.debug ?? {}) as Record<string, unknown>;
    return {
      aiProvider: pick(raw.aiProvider, AI_PROVIDERS, DEFAULTS.aiProvider),
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
      claudePlan: pick(raw.claudePlan, CLAUDE_PLAN_KEYS, DEFAULTS.claudePlan),
      debug: {
        enabled: IS_STATIC_PREVIEW || d.enabled === true,
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
        claudePlan: pick<ClaudePlan | ''>(
          d.claudePlan,
          ['', ...CLAUDE_PLAN_KEYS],
          '',
        ),
        codespacesHours: str(d.codespacesHours),
        actionsMinutes: str(d.actionsMinutes),
        copilotUsd: str(d.copilotUsd),
        claudeUsd: str(d.claudeUsd),
        claudeTokensM: str(d.claudeTokensM),
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
