export interface GithubUser {
  login: string;
  name: string | null;
  avatar_url: string;
  html_url: string;
}

export interface Codespace {
  id: number;
  name: string;
  display_name: string | null;
  state:
    | 'Available'
    | 'Unavailable'
    | 'Deleted'
    | 'Starting'
    | 'Stopping'
    | 'Rebuilding'
    | 'ShuttingDown'
    | 'Failed'
    | string;
  machine: {
    name: string;
    display_name: string;
    cpus: number;
    memory_in_bytes: number;
    storage_in_bytes: number;
  } | null;
  repository: { full_name: string; html_url: string };
  created_at: string;
  last_used_at: string | null;
  location: string;
  retention_expires_at: string | null;
}

// 新 Billing API レスポンス形式（/settings/billing/usage/summary）
export interface BillingUsageItem {
  product: string; // "Actions", "Codespaces", "Copilot" など
  sku: string; // "actions_linux", "codespaces_2_core" など
  unitType: string; // "minutes", "GB-hours", "requests" など
  pricePerUnit: number;
  grossQuantity: number;
  grossAmount: number;
  discountQuantity: number;
  discountAmount: number;
  netQuantity: number;
  netAmount: number;
}

export interface BillingUsageSummary {
  timePeriod: { year: number; month?: number };
  user?: string;
  usageItems: BillingUsageItem[];
}

// Copilot プレミアムリクエスト
export interface PremiumRequestItem {
  product: string; // "Copilot"
  sku: string; // "Copilot Premium Request"
  model: string; // "claude-sonnet-4-5", "gpt-4o" など
  unitType: string; // "requests"
  pricePerUnit: number;
  grossQuantity: number;
  grossAmount: number;
  discountQuantity: number;
  discountAmount: number;
  netQuantity: number;
  netAmount: number;
}

export interface PremiumRequestUsage {
  timePeriod: { year: number; month?: number };
  user?: string;
  usageItems: PremiumRequestItem[];
}

export interface CopilotInfo {
  seat_management_setting?: string;
  plan_type?: string;
  public_code_suggestions?: string;
}
