import { issueLabel, STATUS_PAGE } from '../../shared/serviceStatus';
import type { ServiceIssue, StatusService } from '../../shared/types';
import type { Env } from '../env';
import { workersConfigured } from './cloudflare';
import { pushEnabled, sendToAll } from './push';
import { getServiceStatus } from './serviceStatus';

const NOTIFIED_PREFIX = 'status-notified:';
/** 同じ障害の再通知は1日1回（長引く障害でも通知が続きすぎないように） */
const REMIND_SEC = 24 * 60 * 60 - 120;

/** 状態が悪くなった・新しい障害が付いたときは別の障害として通知する */
const issueKey = (service: StatusService, issue: ServiceIssue) =>
  `${NOTIFIED_PREFIX}${service}:${issue.component}:${issue.status}:${issue.incidents
    .map((i) => i.id)
    .join(',')}`;

const describeIssue = (issue: ServiceIssue) =>
  [issueLabel(issue), ...issue.incidents.map((i) => i.name)].join(' — ');

/** Cron から呼ばれる：見ているコンポーネントに新しい障害があれば、サービスごとにまとめて通知 */
export const checkServiceStatus = async (env: Env) => {
  if (!pushEnabled(env)) {
    return;
  }
  const status = await getServiceStatus();
  // Cloudflare のパネルを出していないなら、Cloudflare の障害は知らせない
  const services: StatusService[] = workersConfigured(env)
    ? ['github', 'cloudflare']
    : ['github'];

  for (const service of services) {
    const fresh: ServiceIssue[] = [];
    for (const issue of status[service]) {
      if (!(await env.KV.get(issueKey(service, issue)))) {
        fresh.push(issue);
      }
    }
    if (fresh.length === 0) {
      continue;
    }
    const result = await sendToAll(env, {
      title: `${STATUS_PAGE[service].service} で障害が発生中`,
      body: fresh.map(describeIssue).join('\n'),
      url: fresh[0].incidents[0]?.url ?? STATUS_PAGE[service].url,
      tag: `status-${service}`,
    });
    console.log('status notified', service, fresh.length, result);
    for (const issue of fresh) {
      await env.KV.put(issueKey(service, issue), '1', {
        expirationTtl: REMIND_SEC,
      });
    }
  }
};
