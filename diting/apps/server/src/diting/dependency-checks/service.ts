import { DependencyCheckRegistry } from "./registry";
import { buildDependencyCheckProviders } from "./providers";
import { DependencyCheckQuery, DependencyCheckResult } from "./types";

type RuntimePluginLike = Parameters<typeof buildDependencyCheckProviders>[0]["plugins"][number];
type DependencyCheckServiceOptions = Omit<Parameters<typeof buildDependencyCheckProviders>[0], "plugins">;

export type DependencyCheckSummary = {
  ready: number;
  total: number;
  degraded: boolean;
  checks: DependencyCheckResult[];
};

export class DependencyCheckService {
  private readonly registry: DependencyCheckRegistry;

  constructor(plugins: RuntimePluginLike[], options: DependencyCheckServiceOptions = {}) {
    this.registry = new DependencyCheckRegistry(buildDependencyCheckProviders({ plugins, ...options }));
  }

  async list(query: DependencyCheckQuery = {}): Promise<DependencyCheckSummary> {
    const checks = await this.registry.list(query);
    const ready = checks.filter((check) => check.status === "ready").length;
    return {
      ready,
      total: checks.length,
      degraded: hasDegradedChecks(checks),
      checks
    };
  }
}

function hasDegradedChecks(checks: DependencyCheckResult[]): boolean {
  const codingRuntimeChecks = checks.filter((check) => check.category === "coding-agent" && check.requiredFor.includes("programming"));
  const codingRuntimeSatisfied = codingRuntimeChecks.length > 1 && codingRuntimeChecks.some((check) => check.status === "ready");
  return checks.some((check) => isDegraded(check) && !(codingRuntimeSatisfied && codingRuntimeChecks.includes(check)));
}

function isDegraded(check: DependencyCheckResult): boolean {
  return check.status === "blocked" || check.status === "warning" || check.status === "unverified";
}
