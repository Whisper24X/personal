import { DependencyCheckProvider, DependencyCheckResult, DependencyCheckStatus } from "./types";
import { buildCliNotFoundMessage, isCliBinaryMissing, runCommand } from "../plugins/shared";

type PluginHealthLike = {
  healthy: boolean;
  message: string;
};

type RuntimePluginLike = {
  id: string;
  kind: string;
  priority: number;
  capabilities: string[];
  displayName?: string;
  binaryPath?: string | null;
  runtimeSource?: string | null;
  runtimeKind?: string | null;
  runtimeProviderId?: string | null;
  health: PluginHealthLike | (() => Promise<PluginHealthLike>);
};

type BuildProvidersInput = {
  plugins: RuntimePluginLike[];
  gitlab?: {
    cliBin: string;
    host: string;
  };
};

async function readHealth(plugin: RuntimePluginLike): Promise<PluginHealthLike> {
  return typeof plugin.health === "function" ? plugin.health() : plugin.health;
}

function statusFromHealth(healthy: boolean, message: string): DependencyCheckStatus {
  if (healthy) {
    return "ready";
  }
  if (/auth_required|not authenticated|unauthenticated|未授权|sign in|login/i.test(message)) {
    return "blocked";
  }
  return "warning";
}

function makePluginProvider(plugin: RuntimePluginLike, input: {
  id: string;
  category: DependencyCheckResult["category"];
  label: string;
  description: string;
  requiredFor: string[];
  action?: DependencyCheckResult["action"];
  itemLabel: string;
  cliName?: string;
}): DependencyCheckProvider {
  return {
    id: input.id,
    category: input.category,
    label: input.label,
    async check() {
      const health = await readHealth(plugin);
      const status = statusFromHealth(health.healthy, health.message);
      return {
        id: input.id,
        category: input.category,
        label: input.label,
        description: input.description,
        status,
        required: false,
        requiredFor: input.requiredFor,
        items: [{ id: "health", label: input.itemLabel, status, detail: health.message }],
        action: status === "ready" ? undefined : input.action,
        publicMetadata: input.cliName ? { cliName: input.cliName } : undefined
      };
    }
  };
}

function isCliMissingMessage(message: string): boolean {
  return /cli.*not found|command not found|not found.*cli|GITLAB_CLI_BIN|ENOENT|missing/i.test(message);
}

function makeGitLabProvider(plugin: RuntimePluginLike): DependencyCheckProvider {
  return {
    id: "gitlab-auth",
    category: "platform",
    label: "GitLab CLI",
    async check() {
      const health = await readHealth(plugin);
      const cliMissing = !health.healthy && isCliMissingMessage(health.message);
      const status: DependencyCheckStatus = health.healthy ? "ready" : "blocked";
      return {
        id: "gitlab-auth",
        category: "platform",
        label: "GitLab CLI",
        description: "GitLab merge request creation and repository platform actions",
        status,
        required: false,
        requiredFor: ["pull-request"],
        items: [
          {
            id: "cli",
            label: "CLI available",
            status: cliMissing ? "blocked" : "ready",
            detail: cliMissing ? health.message : "glab command is available"
          },
          {
            id: "auth",
            label: "Signed in",
            status: health.healthy ? "ready" : "blocked",
            detail: health.message
          }
        ],
        action: health.healthy ? undefined : { kind: "auth", label: "Authorize GitLab", target: "gitlab" },
        publicMetadata: { cliName: "glab" }
      };
    }
  };
}

function makeGitLabFallbackProvider(input: { cliBin: string; host: string }): DependencyCheckProvider {
  return {
    id: "gitlab-auth",
    category: "platform",
    label: "GitLab CLI",
    async check() {
      const version = await runCommand(input.cliBin, ["--version"], process.cwd(), 10_000);
      if (version.exitCode !== 0 || isCliBinaryMissing(version)) {
        const detail = isCliBinaryMissing(version)
          ? buildCliNotFoundMessage("GitLab", input.cliBin, "GITLAB_CLI_BIN")
          : (version.stderr.trim() || version.stdout.trim() || "GitLab CLI is unavailable");
        return {
          id: "gitlab-auth",
          category: "platform",
          label: "GitLab CLI",
          description: "GitLab merge request creation and repository platform actions",
          status: "blocked",
          required: false,
          requiredFor: ["pull-request"],
          items: [
            { id: "cli", label: "CLI available", status: "blocked", detail },
            { id: "auth", label: "Signed in", status: "unknown", detail: "Skipped because GitLab CLI is unavailable" }
          ],
          publicMetadata: { cliName: "glab" }
        };
      }
      const auth = await runCommand(input.cliBin, ["auth", "status", "--hostname", input.host], process.cwd(), 10_000);
      const authenticated = auth.exitCode === 0;
      return {
        id: "gitlab-auth",
        category: "platform",
        label: "GitLab CLI",
        description: "GitLab merge request creation and repository platform actions",
        status: authenticated ? "ready" : "blocked",
        required: false,
        requiredFor: ["pull-request"],
        items: [
          {
            id: "cli",
            label: "CLI available",
            status: "ready",
            detail: version.stdout.trim() || version.stderr.trim() || "glab command is available"
          },
          {
            id: "auth",
            label: "Signed in",
            status: authenticated ? "ready" : "blocked",
            detail: authenticated
              ? (auth.stdout.trim() || auth.stderr.trim() || `GitLab CLI is authenticated for ${input.host}`)
              : (auth.stderr.trim() || auth.stdout.trim() || "GitLab CLI authorization required")
          }
        ],
        publicMetadata: { cliName: "glab" }
      };
    }
  };
}

function makeCodingRuntimeProvider(plugins: RuntimePluginLike[], runtime: string): DependencyCheckProvider {
  const candidates = [...plugins].sort((left, right) => right.priority - left.priority);
  return {
    id: `${runtime}-runtime`,
    category: "coding-agent",
    label: `${runtime[0].toUpperCase()}${runtime.slice(1)} CLI`,
    async check() {
      const healths = await Promise.all(candidates.map(async (plugin) => ({
        plugin,
        health: await readHealth(plugin)
      })));
      const ready = healths.find((item) => item.health.healthy);
      const selected = ready ?? healths[0];
      const status: DependencyCheckStatus = ready ? "ready" : "blocked";
      return {
        id: `${runtime}-runtime`,
        category: "coding-agent",
        label: `${runtime[0].toUpperCase()}${runtime.slice(1)} CLI`,
        description: `${runtime} coding runtime provider`,
        status,
        required: false,
        requiredFor: ["programming"],
        items: [{
          id: "cli",
          label: "CLI available",
          status,
          detail: selected?.health.message ?? `${runtime} CLI is unavailable`
        }],
        action: ready ? undefined : { kind: "configure", label: `Configure ${runtime}`, target: runtime },
        publicMetadata: { cliName: runtime }
      };
    }
  };
}

export function buildDependencyCheckProviders(input: BuildProvidersInput): DependencyCheckProvider[] {
  const providers = new Map<string, DependencyCheckProvider>();
  const runtimePlugins = new Map<string, RuntimePluginLike[]>();
  for (const plugin of input.plugins) {
    if (plugin.id === "meegle") {
      providers.set("meegle-auth", makePluginProvider(plugin, {
        id: "meegle-auth",
        category: "task-integration",
        label: "Meegle CLI",
        description: "Meegle task intake and review synchronization",
        requiredFor: ["task-sync", "product-task"],
        action: { kind: "auth", label: "Authorize Meegle", target: "meegle" },
        itemLabel: "Signed in",
        cliName: "meegle"
      }));
      continue;
    }
    if (plugin.id === "gitlab") {
      providers.set("gitlab-auth", makeGitLabProvider(plugin));
      continue;
    }
    const runtime = getCodingRuntime(plugin);
    if (runtime) {
      runtimePlugins.set(runtime, [...(runtimePlugins.get(runtime) ?? []), plugin]);
    }
  }
  for (const [runtime, plugins] of runtimePlugins) {
    providers.set(`${runtime}-runtime`, makeCodingRuntimeProvider(plugins, runtime));
  }
  if (!providers.has("gitlab-auth") && input.gitlab) {
    providers.set("gitlab-auth", makeGitLabFallbackProvider(input.gitlab));
  }
  return [...providers.values()];
}

function getCodingRuntime(plugin: RuntimePluginLike): string | null {
  if (plugin.kind !== "agent") {
    return null;
  }
  if (isProductRuntimePlugin(plugin)) {
    return null;
  }
  const runtime = plugin.runtimeProviderId ?? plugin.runtimeKind;
  if (runtime) {
    return runtime;
  }
  if (/codex/.test(plugin.id)) {
    return "codex";
  }
  if (/cursor/.test(plugin.id)) {
    return "cursor";
  }
  return null;
}

function isProductRuntimePlugin(plugin: RuntimePluginLike): boolean {
  return plugin.id.startsWith("openspec-product-") || plugin.capabilities.includes("product");
}
