const yaml = require("js-yaml") as { load: (input: string) => unknown };

export type ServiceStartupDefaults = {
  startupTimeoutMs?: number;
  stopTimeoutMs?: number;
  env?: Record<string, string>;
};

export type ServiceStartupServiceConfig = {
  id: string;
  repoKey?: string;
  cwd: string;
  command: string[];
  healthUrl: string;
  dependsOn?: string[];
  env?: Record<string, string>;
  port?: number;
  healthIntervalMs?: number;
  startupTimeoutMs?: number;
  stopTimeoutMs?: number;
};

export type ServiceStartupFileConfig = {
  schemaVersion: 1;
  defaults?: ServiceStartupDefaults;
  services: ServiceStartupServiceConfig[];
};

export type ServiceStartupConfig = {
  enabled?: boolean;
  startupTiming?: "before_quality";
  configPath?: string;
  servicesYaml?: string;
  services?: ServiceStartupServiceConfig[];
  startupTimeoutMs?: number;
  skipHealthCheck?: boolean;
  restartBeforeQuality?: boolean;
};

export type RunningService = {
  id: string;
  pid: number;
  cwd: string;
  command: string[];
  healthUrl: string;
  startedAt: string;
  readyAt: string | null;
  status: "starting" | "ready" | "failed" | "stopped";
};

export type WorkspaceServicesSnapshot = {
  schemaVersion: 1;
  configSource: "task" | "file" | "inferred";
  running: RunningService[];
};

export function parseServiceStartupConfigYaml(source: string): ServiceStartupFileConfig {
  const loaded = yaml.load(source);
  const root = asRecord(loaded, "service startup config must be an object");
  const schemaVersion = asNumber(root.schemaVersion, "service startup schemaVersion must be 1");
  if (schemaVersion !== 1) {
    throw new Error("service startup schemaVersion must be 1");
  }

  const servicesValue = root.services;
  if (!Array.isArray(servicesValue) || servicesValue.length === 0) {
    throw new Error("services must be a non-empty array");
  }

  const defaultsValue = root.defaults;
  const defaults = defaultsValue == null ? undefined : parseDefaults(defaultsValue);
  const services = servicesValue.map((value, index) => parseServiceConfig(value, index));

  return {
    schemaVersion: 1,
    defaults,
    services
  };
}

function parseDefaults(input: unknown): ServiceStartupDefaults {
  const record = asRecord(input, "defaults must be an object");
  return {
    startupTimeoutMs: parseOptionalPositiveNumber(record.startupTimeoutMs, "defaults.startupTimeoutMs"),
    stopTimeoutMs: parseOptionalPositiveNumber(record.stopTimeoutMs, "defaults.stopTimeoutMs"),
    env: parseOptionalEnv(record.env, "defaults.env")
  };
}

function parseServiceConfig(input: unknown, index: number): ServiceStartupServiceConfig {
  const basePath = `services[${index}]`;
  const record = asRecord(input, `${basePath} must be an object`);
  return {
    id: asNonEmptyString(record.id, `${basePath}.id is required`),
    repoKey: parseOptionalString(record.repoKey, `${basePath}.repoKey`),
    cwd: asNonEmptyString(record.cwd, `${basePath}.cwd is required`),
    command: parseStringArray(record.command, `${basePath}.command`),
    healthUrl: asNonEmptyString(record.healthUrl, `${basePath}.healthUrl is required`),
    dependsOn: parseOptionalStringArray(record.dependsOn, `${basePath}.dependsOn`),
    env: parseOptionalEnv(record.env, `${basePath}.env`),
    port: parseOptionalPositiveNumber(record.port, `${basePath}.port`),
    healthIntervalMs: parseOptionalPositiveNumber(record.healthIntervalMs, `${basePath}.healthIntervalMs`),
    startupTimeoutMs: parseOptionalPositiveNumber(record.startupTimeoutMs, `${basePath}.startupTimeoutMs`),
    stopTimeoutMs: parseOptionalPositiveNumber(record.stopTimeoutMs, `${basePath}.stopTimeoutMs`)
  };
}

function asRecord(value: unknown, message: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(message);
  }
  return value as Record<string, unknown>;
}

function asNonEmptyString(value: unknown, message: string): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(message);
  }
  return value;
}

function asNumber(value: unknown, message: string): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new Error(message);
  }
  return value;
}

function parseOptionalString(value: unknown, fieldPath: string): string | undefined {
  if (value == null) {
    return undefined;
  }
  return asNonEmptyString(value, `${fieldPath} must be a non-empty string`);
}

function parseOptionalPositiveNumber(value: unknown, fieldPath: string): number | undefined {
  if (value == null) {
    return undefined;
  }
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) {
    throw new Error(`${fieldPath} must be a positive number`);
  }
  return value;
}

function parseStringArray(value: unknown, fieldPath: string): string[] {
  if (!Array.isArray(value) || value.length === 0) {
    throw new Error(`${fieldPath} must be a non-empty string array`);
  }
  return value.map((item, index) => asNonEmptyString(item, `${fieldPath}[${index}] must be a non-empty string`));
}

function parseOptionalStringArray(value: unknown, fieldPath: string): string[] | undefined {
  if (value == null) {
    return undefined;
  }
  return parseStringArray(value, fieldPath);
}

function parseOptionalEnv(value: unknown, fieldPath: string): Record<string, string> | undefined {
  if (value == null) {
    return undefined;
  }
  const record = asRecord(value, `${fieldPath} must be an object`);
  const env: Record<string, string> = {};
  for (const [key, raw] of Object.entries(record)) {
    env[key] = asNonEmptyString(raw, `${fieldPath}.${key} must be a non-empty string`);
  }
  return env;
}
