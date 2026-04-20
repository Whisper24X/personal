/**
 * Project.configJson.containerRuntime.ephemeralMcp — per-task MCP spawn inside the task runner container.
 *
 * HTTP/SSE: `command` + `listenPort` must reach a listener inside the runner so Agent CLIs can use `http://127.0.0.1:<port>...`.
 *
 * stdio-only servers are not wired to remote Agent CLIs without an HTTP bridge; use an HTTP-capable build or proxy.
 */
export type EphemeralMcpTransport = 'http';

export type EphemeralMcpTemplate = {
  id: string;
  /** When false, template is skipped. Default true. */
  enabled?: boolean;
  transport?: EphemeralMcpTransport;
  listenPort: number;
  command: string;
  args?: string[];
  /** Working directory inside the runner container (default: runner workspace, e.g. /workspace). */
  cwdInContainer?: string;
  env?: Record<string, string>;
  /**
   * HTTP path for readiness polling (GET). Default `/health`.
   * Use `/` if the server has no dedicated health route; any 2xx–499 counts as ready (except connection refusal).
   */
  healthPath?: string;
  /** Path segment appended after `http://127.0.0.1:<port>` for the injected URL. Default `/sse`. */
  urlPath?: string;
  /** Env var name for the full base URL (scheme + host + port + urlPath). */
  envVarName?: string;
  spawnTimeoutMs?: number;
};

export type EphemeralMcpConfig = {
  templates?: EphemeralMcpTemplate[];
  /**
   * Max enabled templates started for one task run. Default 8.
   * When exceeded, extra templates are skipped with a warning log.
   */
  maxConcurrentPerRunner?: number;
  /**
   * When true (default), spawned MCP processes receive `AINATIVE_*` and `AINATIVE_EPHEMERAL_MCP_CONTEXT` JSON.
   */
  injectAuditEnv?: boolean;
};
