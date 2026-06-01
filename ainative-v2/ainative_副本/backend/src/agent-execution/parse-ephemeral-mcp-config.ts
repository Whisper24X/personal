import type {
  EphemeralMcpConfig,
  EphemeralMcpTemplate,
} from './ephemeral-mcp.types';

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function parseTemplate(
  raw: unknown,
  index: number,
): EphemeralMcpTemplate | null {
  if (!isRecord(raw)) {
    return null;
  }
  const id =
    typeof raw.id === 'string' && raw.id.trim()
      ? raw.id.trim()
      : `template_${index}`;
  const enabled = raw.enabled === false ? false : true;
  const transport = raw.transport === 'http' ? 'http' : 'http';
  const listenPort = Number(raw.listenPort);
  if (!Number.isInteger(listenPort) || listenPort <= 0 || listenPort > 65535) {
    return null;
  }
  const command =
    typeof raw.command === 'string' && raw.command.trim()
      ? raw.command.trim()
      : null;
  if (!command) {
    return null;
  }

  let args: string[] | undefined;
  if (Array.isArray(raw.args)) {
    const list = raw.args.filter((a) => typeof a === 'string') as string[];
    args = list.length ? list : undefined;
  }

  let cwdInContainer: string | undefined;
  if (typeof raw.cwdInContainer === 'string' && raw.cwdInContainer.trim()) {
    cwdInContainer = raw.cwdInContainer.trim();
  }

  let env: Record<string, string> | undefined;
  if (isRecord(raw.env)) {
    env = Object.entries(raw.env).reduce<Record<string, string>>(
      (acc, [k, v]) => {
        if (typeof v === 'string' && v.length) {
          acc[k] = v;
        }
        return acc;
      },
      {},
    );
    if (!Object.keys(env).length) {
      env = undefined;
    }
  }

  let healthPath: string | undefined;
  if (typeof raw.healthPath === 'string' && raw.healthPath.length) {
    healthPath = raw.healthPath.startsWith('/')
      ? raw.healthPath
      : `/${raw.healthPath}`;
  }

  let urlPath: string | undefined;
  if (typeof raw.urlPath === 'string' && raw.urlPath.length) {
    urlPath = raw.urlPath.startsWith('/') ? raw.urlPath : `/${raw.urlPath}`;
  }

  let envVarName: string | undefined;
  if (typeof raw.envVarName === 'string' && raw.envVarName.trim()) {
    envVarName = raw.envVarName.trim();
  }

  let spawnTimeoutMs: number | undefined;
  if (typeof raw.spawnTimeoutMs === 'number' && raw.spawnTimeoutMs > 0) {
    spawnTimeoutMs = Math.min(Math.floor(raw.spawnTimeoutMs), 600_000);
  }

  return {
    id,
    enabled,
    transport,
    listenPort,
    command,
    ...(args ? { args } : {}),
    ...(cwdInContainer ? { cwdInContainer } : {}),
    ...(env ? { env } : {}),
    ...(healthPath ? { healthPath } : {}),
    ...(urlPath ? { urlPath } : {}),
    ...(envVarName ? { envVarName } : {}),
    ...(spawnTimeoutMs ? { spawnTimeoutMs } : {}),
  };
}

/**
 * Reads `configJson.containerRuntime.ephemeralMcp` from a project snapshot.
 */
export function parseEphemeralMcpConfig(
  configJson: Record<string, unknown> | null | undefined,
): EphemeralMcpConfig | null {
  if (!isRecord(configJson)) {
    return null;
  }
  const cr = configJson.containerRuntime;
  if (!isRecord(cr)) {
    return null;
  }
  const rawRoot = cr.ephemeralMcp;
  if (!isRecord(rawRoot)) {
    return null;
  }

  const templatesRaw = rawRoot.templates;
  const templates: EphemeralMcpTemplate[] = [];
  if (Array.isArray(templatesRaw)) {
    templatesRaw.forEach((item, idx) => {
      const t = parseTemplate(item, idx);
      if (t) {
        templates.push(t);
      }
    });
  }

  let maxConcurrentPerRunner: number | undefined;
  if (
    typeof rawRoot.maxConcurrentPerRunner === 'number' &&
    rawRoot.maxConcurrentPerRunner > 0
  ) {
    maxConcurrentPerRunner = Math.min(
      Math.floor(rawRoot.maxConcurrentPerRunner),
      32,
    );
  }

  const injectAuditEnv =
    rawRoot.injectAuditEnv === false ? false : (true as const);

  if (!templates.length) {
    return null;
  }

  return {
    templates,
    ...(maxConcurrentPerRunner ? { maxConcurrentPerRunner } : {}),
    injectAuditEnv,
  };
}
