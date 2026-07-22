import { access, readFile } from "node:fs/promises";
import { join } from "node:path";
import {
  PreparedWorkspace,
  ServiceStartupConfig,
  ServiceStartupFileConfig,
  ServiceStartupServiceConfig,
  TitingTask,
  parseServiceStartupConfigYaml
} from "@diting/plugin-api";

export type DiscoveredServiceStartupConfig =
  | {
      enabled: true;
      configSource: "task";
      config: ServiceStartupConfig;
    }
  | {
      enabled: true;
      configSource: "file";
      configPath: string;
      configPaths?: string[];
      config: ServiceStartupFileConfig;
    }
  | {
      enabled: false;
      configSource: "task" | "disabled";
    };

export async function discoverServiceStartupConfig(
  task: TitingTask,
  workspace: PreparedWorkspace
): Promise<DiscoveredServiceStartupConfig> {
  const taskConfig = readTaskServiceStartup(task.metadata);
  if (taskConfig) {
    if (taskConfig.enabled === false) {
      return {
        enabled: false,
        configSource: "task"
      };
    }

    if (Array.isArray(taskConfig.services) && taskConfig.services.length > 0) {
      return {
        enabled: true,
        configSource: "task",
        config: taskConfig
      };
    }
  }

  const configPath = taskConfig?.configPath ?? ".diting/services.yaml";
  const discoveredFiles = await discoverConfigFiles(workspace, configPath);
  if (discoveredFiles.length === 1) {
    const [discoveredFile] = discoveredFiles;
    return {
      enabled: true,
      configSource: "file",
      configPath: discoveredFile.path,
      config: parseServiceStartupConfigYaml(await readFile(discoveredFile.path, "utf8"))
    };
  }
  if (discoveredFiles.length > 1) {
    const configServices: ServiceStartupServiceConfig[] = [];
    for (const file of discoveredFiles) {
      const config = parseServiceStartupConfigYaml(await readFile(file.path, "utf8"));
      for (const service of config.services) {
        configServices.push({
          ...service,
          repoKey: service.repoKey ?? file.repoKey,
          env: {
            ...(config.defaults?.env ?? {}),
            ...(service.env ?? {})
          },
          startupTimeoutMs: service.startupTimeoutMs ?? config.defaults?.startupTimeoutMs,
          stopTimeoutMs: service.stopTimeoutMs ?? config.defaults?.stopTimeoutMs
        });
      }
    }
    return {
      enabled: true,
      configSource: "file",
      configPath: discoveredFiles[0].path,
      configPaths: discoveredFiles.map((file) => file.path),
      config: {
        schemaVersion: 1,
        services: configServices
      }
    };
  }

  return {
    enabled: false,
    configSource: "disabled"
  };
}

function readTaskServiceStartup(metadata: Record<string, unknown>): ServiceStartupConfig | null {
  const raw = metadata.serviceStartup;
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return null;
  }
  const record = raw as Record<string, unknown>;
  return {
    enabled: typeof record.enabled === "boolean" ? record.enabled : undefined,
    startupTiming: record.startupTiming === "before_quality" ? "before_quality" : undefined,
    configPath: asNonEmptyString(record.configPath),
    servicesYaml: asNonEmptySource(record.servicesYaml),
    services: parseServiceArray(record.services),
    startupTimeoutMs: asPositiveNumber(record.startupTimeoutMs),
    skipHealthCheck: typeof record.skipHealthCheck === "boolean" ? record.skipHealthCheck : undefined,
    restartBeforeQuality: typeof record.restartBeforeQuality === "boolean" ? record.restartBeforeQuality : undefined
  };
}

function parseServiceArray(value: unknown): ServiceStartupServiceConfig[] | undefined {
  if (!Array.isArray(value)) {
    return undefined;
  }

  const parsed = value
    .map((item) => parseService(item))
    .filter((item): item is ServiceStartupServiceConfig => item !== null);
  return parsed.length > 0 ? parsed : [];
}

function parseService(value: unknown): ServiceStartupServiceConfig | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }
  const record = value as Record<string, unknown>;
  const id = asNonEmptyString(record.id);
  const cwd = asNonEmptyString(record.cwd);
  const healthUrl = asNonEmptyString(record.healthUrl);
  const command = asStringArray(record.command);
  if (!id || !cwd || !healthUrl || command.length === 0) {
    return null;
  }

  return {
    id,
    repoKey: asNonEmptyString(record.repoKey),
    cwd,
    command,
    healthUrl,
    dependsOn: asStringArray(record.dependsOn),
    env: asStringRecord(record.env),
    port: asPositiveNumber(record.port),
    healthIntervalMs: asPositiveNumber(record.healthIntervalMs),
    startupTimeoutMs: asPositiveNumber(record.startupTimeoutMs),
    stopTimeoutMs: asPositiveNumber(record.stopTimeoutMs)
  };
}

async function discoverConfigFiles(
  workspace: PreparedWorkspace,
  relativePath: string
): Promise<Array<{ path: string; repoKey: string }>> {
  const candidateRepos = uniqueRepos(workspace);
  const configFiles: Array<{ path: string; repoKey: string }> = [];
  for (const repo of candidateRepos) {
    const configPath = join(repo.path, relativePath);
    if (await pathExists(configPath)) {
      configFiles.push({ path: configPath, repoKey: repo.key });
    }
  }
  return configFiles;
}

async function pathExists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

function uniqueRepos(workspace: PreparedWorkspace): Array<{ key: string; path: string }> {
  const repos = workspace.repos.length > 0 ? workspace.repos : [{
    key: "Repo1",
    path: workspace.repoPath
  }];
  const candidates = [
    { key: repos[0]?.key ?? "Repo1", path: workspace.repoPath },
    ...repos.map((repo) => ({ key: repo.key, path: repo.path }))
  ];
  const seen = new Set<string>();
  return candidates.filter((repo) => {
    if (seen.has(repo.path)) {
      return false;
    }
    seen.add(repo.path);
    return true;
  });
}

function asNonEmptyString(value: unknown): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function asNonEmptySource(value: unknown): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }
  return value.trim().length > 0 ? value : undefined;
}

function asPositiveNumber(value: unknown): number | undefined {
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) {
    return undefined;
  }
  return value;
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.trim())
    .filter((item) => item.length > 0);
}

function asStringRecord(value: unknown): Record<string, string> | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return undefined;
  }

  const env: Record<string, string> = {};
  for (const [key, raw] of Object.entries(value as Record<string, unknown>)) {
    if (typeof raw === "string" && raw.trim().length > 0) {
      env[key] = raw;
    }
  }
  return Object.keys(env).length > 0 ? env : undefined;
}
