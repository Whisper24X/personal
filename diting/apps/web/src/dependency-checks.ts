import { fetchJson, postJson } from "./api";

export type DependencyCheckStatus = "ready" | "warning" | "blocked" | "checking" | "unknown" | "unverified";

export type DependencyCheckCategory = "coding-agent" | "task-integration" | "platform" | "openspec" | "environment";

export type DependencyCheck = {
  id: string;
  category: DependencyCheckCategory;
  label: string;
  description: string;
  status: DependencyCheckStatus;
  required: boolean;
  optionalReason?: string;
  requiredFor: string[];
  items: Array<{ id: string; label: string; status: DependencyCheckStatus; detail: string }>;
  action?: { kind: "auth" | "configure" | "install" | "open-settings" | "external-doc"; label: string; target: string };
  lastCheckedAt?: string;
};

export type DependencyCheckSummary = {
  ready: number;
  total: number;
  degraded: boolean;
  checks: DependencyCheck[];
};

export function listDependencyChecks(): Promise<DependencyCheckSummary> {
  return fetchJson<DependencyCheckSummary>("/dependency-checks");
}

export function recheckDependencies(ids?: string[]): Promise<DependencyCheckSummary> {
  return postJson<DependencyCheckSummary>("/dependency-checks/recheck", ids ? { ids } : undefined);
}
