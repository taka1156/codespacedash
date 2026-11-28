import clsx from 'clsx';
import { createContext, type ReactNode, useContext } from 'react';
import { isSevere, issueLabel, STATUS_PAGE } from '@/lib/serviceStatus';
import type { ServiceIssue, StatusService } from '@/lib/types';
import {
  hint,
  strip,
  stripLabel,
  stripLink,
  stripSevere,
  strips,
} from './style.css';

interface Scope {
  service: StatusService;
  /** このパネルに関係するコンポーネントの障害（パネルの帯に出す） */
  issues: ServiceIssue[];
  /** サービス全体に関係する障害（API など。取得エラーの理由として添える） */
  common: ServiceIssue[];
}

const ScopeContext = createContext<Scope | null>(null);

/** 中のパネル（BasePanel・StatusNote）に、関係する障害を渡す */
export const StatusScope = ({
  children,
  ...scope
}: Scope & { children: ReactNode }) => (
  <ScopeContext.Provider value={scope}>{children}</ScopeContext.Provider>
);

const ext = { target: '_blank', rel: 'noopener noreferrer' } as const;

/** 障害の帯。状態名は日本語、障害のタイトルはステータスページの英語のまま */
export const IssueStrips = ({
  service,
  issues,
}: {
  service: StatusService;
  issues: ServiceIssue[];
}) =>
  issues.length > 0 && (
    <div className={strips}>
      {issues.map((issue) => {
        const [first] = issue.incidents;
        return (
          <div
            key={issue.component}
            role="status"
            className={clsx(strip, isSevere(issue.status) && stripSevere)}
          >
            <span className={stripLabel}>{issueLabel(issue)}</span>
            {issue.incidents.map((i) => ` — ${i.name}`).join('')}{' '}
            <a
              className={stripLink}
              href={first?.url ?? STATUS_PAGE[service].url}
              {...ext}
            >
              {STATUS_PAGE[service].name} ↗
            </a>
          </div>
        );
      })}
    </div>
  );

/** BasePanel の中身の先頭に出す帯 */
export const ScopedIssueStrips = () => {
  const scope = useContext(ScopeContext);
  return scope && <IssueStrips service={scope.service} issues={scope.issues} />;
};

/** 取得エラーの枠に添える一言（障害が出ていなければ何も出さない） */
export const OutageHint = () => {
  const scope = useContext(ScopeContext);
  const all = scope ? [...scope.common, ...scope.issues] : [];
  if (!scope || all.length === 0) {
    return null;
  }
  const { service, url } = STATUS_PAGE[scope.service];
  return (
    <span className={hint}>
      {service} 側で障害が発生中です（
      {all.map((i) => i.component).join('・')}
      ）。トークンではなく、そちらが原因かもしれません{' '}
      <a className={stripLink} href={url} {...ext}>
        ↗
      </a>
    </span>
  );
};
