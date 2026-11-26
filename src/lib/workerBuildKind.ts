import type { WorkerBuild } from './types';

export type BuildKind =
  | 'success'
  | 'failure'
  | 'neutral'
  | 'running'
  | 'queued';

export const buildKind = (b: WorkerBuild): BuildKind => {
  if (b.status === 'queued') {
    return 'queued';
  }
  if (b.status !== 'stopped') {
    return 'running';
  }
  switch (b.outcome) {
    case 'success':
      return 'success';
    case 'fail':
    case 'terminated':
      return 'failure';
    default:
      return 'neutral';
  }
};
