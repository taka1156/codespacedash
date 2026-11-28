import { STATUS_PAGE, watchedComponents } from '../../shared/serviceStatus';
import type {
  ComponentStatus,
  ServiceIncident,
  ServiceIssue,
  ServiceStatus,
  StatusService,
} from '../../shared/types';

// 公式ステータスページ（Atlassian Statuspage 形式）の summary.json。認証は不要。
// Cloudflare は連絡先つきの User-Agent を求めている（ないと厳しめに制限される）
const USER_AGENT = 'quotadash (+https://github.com/taka1156/quotadash)';
const CACHE_MS = 5 * 60_000;

interface RawComponent {
  id: string;
  name: string;
  status: 'operational' | ComponentStatus;
  /** グループ（子をまとめる見出し）は状態を見ない */
  group?: boolean;
}

interface RawIncident {
  id: string;
  name: string;
  shortlink?: string | null;
  components?: { id: string }[];
}

interface RawSummary {
  components?: RawComponent[];
  incidents?: RawIncident[];
  scheduled_maintenances?: RawIncident[];
}

/** 見ているコンポーネントのうち正常でないものに、関係する障害を添える */
export const toIssues = (
  service: StatusService,
  summary: RawSummary,
): ServiceIssue[] => {
  const watched = watchedComponents(service);
  const incidents = [
    ...(summary.incidents ?? []),
    ...(summary.scheduled_maintenances ?? []),
  ];
  const seen = new Set<string>();
  const issues: ServiceIssue[] = [];
  for (const c of summary.components ?? []) {
    // 同じ名前がグループの下に重なっていることがあるので、最初の1つだけ
    if (
      c.group ||
      c.status === 'operational' ||
      !watched.includes(c.name) ||
      seen.has(c.name)
    ) {
      continue;
    }
    seen.add(c.name);
    issues.push({
      component: c.name,
      status: c.status,
      incidents: incidents
        .filter((i) => i.components?.some((ic) => ic.id === c.id))
        .map(
          (i): ServiceIncident => ({
            id: i.id,
            name: i.name,
            url: i.shortlink || `${STATUS_PAGE[service].url}/incidents/${i.id}`,
          }),
        ),
    });
  }
  return issues;
};

const cached: Partial<
  Record<StatusService, { at: number; issues: ServiceIssue[] }>
> = {};

const fetchIssues = async (service: StatusService) => {
  const hit = cached[service];
  if (hit && Date.now() - hit.at < CACHE_MS) {
    return hit.issues;
  }
  const res = await fetch(`${STATUS_PAGE[service].url}/api/v2/summary.json`, {
    headers: { Accept: 'application/json', 'User-Agent': USER_AGENT },
  });
  if (!res.ok) {
    throw new Error(`${STATUS_PAGE[service].name} ${res.status}`);
  }
  const issues = toIssues(service, (await res.json()) as RawSummary);
  cached[service] = { at: Date.now(), issues };
  return issues;
};

/**
 * GitHub・Cloudflare の状態。取れなかったサービスは空にする
 * （ステータスページが見られないことでダッシュボードを止めない）
 */
export const getServiceStatus = async (): Promise<ServiceStatus> => {
  const [github, cloudflare] = await Promise.all(
    (['github', 'cloudflare'] as const).map((s) =>
      fetchIssues(s).catch((e: unknown) => {
        console.warn('service status unavailable', s, e);
        return [];
      }),
    ),
  );
  return { github, cloudflare };
};
