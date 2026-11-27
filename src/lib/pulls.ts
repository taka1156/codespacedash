import type { RepoPulls, SectionState } from './types';

/** オープンな PR の合計（取れていなければ null） */
export const totalPulls = (pulls: SectionState<RepoPulls[]> | null) =>
  pulls?.status === 'ok'
    ? pulls.data.reduce((n, r) => n + r.totalCount, 0)
    : null;
