export type DependencyCheckStatus = "ready" | "warning" | "blocked" | "checking" | "unknown" | "unverified";

export type DependencyCheckCategory = "coding-agent" | "task-integration" | "platform" | "openspec" | "environment";

export type DependencyCheckItem = {
  id: string;
  label: string;
  status: DependencyCheckStatus;
  detail: string;
};

export type DependencyCheckAction = {
  kind: "auth" | "configure" | "install" | "open-settings" | "external-doc";
  label: string;
  target: string;
};

export type DependencyCheckPublicMetadata = {
  cliName?: string;
  version?: string;
  configKey?: string;
  docsUrl?: string;
};

export type DependencyCheckResult = {
  id: string;
  category: DependencyCheckCategory;
  label: string;
  description: string;
  status: DependencyCheckStatus;
  required: boolean;
  optionalReason?: string;
  requiredFor: string[];
  items: DependencyCheckItem[];
  action?: DependencyCheckAction;
  lastCheckedAt?: string;
  publicMetadata?: DependencyCheckPublicMetadata;
};

export type DependencyCheckQuery = {
  category?: DependencyCheckCategory;
  requiredFor?: string;
  ids?: string[];
};

export type DependencyCheckProvider = {
  id: string;
  category: DependencyCheckCategory;
  label: string;
  check(): Promise<DependencyCheckResult>;
};

const SENSITIVE_DETAIL_PATTERNS = [
  /\btoken=[^\s]+/gi,
  /\bdevice[_-]?code=[^\s]+/gi,
  /\buser[_-]?code=[^\s]+/gi,
  /\/Users\/[^\s]+\/\.config\/[^\s]+/g
];

export function sanitizeDetail(detail: string): string {
  return SENSITIVE_DETAIL_PATTERNS.reduce((current, pattern) => current.replace(pattern, "[redacted]"), detail);
}

export function sanitizeDependencyCheck(check: DependencyCheckResult): DependencyCheckResult {
  return {
    ...check,
    items: check.items.map((item) => ({
      ...item,
      detail: sanitizeDetail(item.detail)
    })),
    publicMetadata: check.publicMetadata
      ? {
          cliName: check.publicMetadata.cliName,
          version: check.publicMetadata.version,
          configKey: check.publicMetadata.configKey,
          docsUrl: check.publicMetadata.docsUrl
        }
      : undefined
  };
}
