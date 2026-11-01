export interface Env {
  // ── Secrets（wrangler secret put / ローカルは .dev.vars）──
  /** Fine-grained PAT。ブラウザには一切渡さない */
  GITHUB_TOKEN: string;
  /** VAPID 秘密鍵（JWK を JSON 文字列のまま） */
  VAPID_PRIVATE_JWK?: string;

  // ── Vars（wrangler.jsonc）──
  /** 例: yourteam.cloudflareaccess.com */
  ACCESS_TEAM_DOMAIN?: string;
  /** Access アプリケーションの Application Audience (AUD) Tag */
  ACCESS_AUD?: string;
  VAPID_PUBLIC_KEY?: string;
  /** 例: mailto:you@example.com */
  VAPID_SUBJECT?: string;
  /** 最終使用からこの分数以上 起動中なら通知 */
  NOTIFY_AFTER_MIN?: string;
  /** 同じ Codespace の再通知間隔（分） */
  REMIND_EVERY_MIN?: string;
  /** 課金集計の「今月」を決めるタイムゾーン */
  TIMEZONE?: string;

  // ── Bindings ──
  ASSETS: Fetcher;
  /** プッシュ購読と通知済みフラグの保存先 */
  KV: KVNamespace;
}

export type AppEnv = { Bindings: Env };

export const numVar = (v: string | undefined, fallback: number) => {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : fallback;
};
