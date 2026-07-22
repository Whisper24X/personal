export const API_BASE = import.meta.env.VITE_API_BASE_URL ?? "/api";

export type Run = {
  id: string;
  taskId: string;
  agentId: string | null;
  workspace: string;
  status: string;
  summary: string | null;
  executor: string;
  agentKind?: string;
  driverId?: string | null;
  runtimeProviderId?: string | null;
  startedAt: string;
  endedAt: string | null;
};

export type RunStageKey = "workspace" | "execute" | "completion_gate" | "quality" | "repair" | "pull_request" | "done";

export type RunStage = {
  key: RunStageKey;
  label: string;
  status: "pending" | "running" | "done" | "failed" | "skipped";
  startedAt: string | null;
  endedAt: string | null;
  summary: string | null;
};

export type RunStep = {
  id: string;
  runId: string;
  stage: RunStageKey;
  status: "running" | "done" | "failed" | "skipped";
  title: string;
  message: string;
  pluginId: string | null;
  startedAt: string | null;
  endedAt: string | null;
  error: string | null;
};

export type RunPluginRef = {
  pluginId: string;
  kind: string;
  participationSource: "actual" | "fallback";
  fallbackReason: "missing_plugin_correlation" | "readiness_required" | "runtime_available" | null;
  status: "pending" | "running" | "done" | "failed" | "skipped";
  health: "healthy" | "unhealthy" | "unknown";
  summary: string | null;
  lastEventAt: string | null;
};

export type RunObservability = {
  schemaVersion: string;
  run: Run;
  stages: RunStage[];
  steps: RunStep[];
  plugins: RunPluginRef[];
  rawLogs: {
    available: boolean;
    endpoint: string;
    sources: Array<"stdout" | "stderr" | "summary" | "event" | "file">;
    scope: "run" | "task";
    redacted: boolean;
  };
};

export type RunRawLogItem = {
  id: string;
  runId: string | null;
  taskId: string;
  source: "stdout" | "stderr" | "summary" | "event" | "file";
  channel: string;
  stage: RunStageKey | null;
  pluginId: string | null;
  createdAt: string;
  text: string;
  redacted: boolean;
};

export type RunRawLogsResponse = {
  schemaVersion: string;
  runId: string;
  taskId: string;
  scope: "run" | "task";
  redacted: boolean;
  items: RunRawLogItem[];
  nextCursor: string | null;
};

export type RawLogQueryInput = {
  source?: string;
  q?: string;
  cursor?: string;
};

function resolveBackendHost(): string {
  return new URL(API_BASE, "http://localhost:3000").host;
}

/** fetch 因后端不可达抛出的 TypeError（Failed to fetch / Load failed）转成可读提示。 */
async function requestWithFriendlyError(input: string, init?: RequestInit): Promise<Response> {
  try {
    return init === undefined ? await fetch(input) : await fetch(input, init);
  } catch (error) {
    if (error instanceof TypeError) {
      const backendHost = resolveBackendHost();
      throw new Error(`无法连接后端服务（${backendHost}），请确认后端已启动`, { cause: error });
    }
    throw error;
  }
}

/** 优先使用后端响应体里的 error / message 文案，缺失时回退到状态码提示。 */
async function throwResponseError(response: Response): Promise<never> {
  let detail = "";
  try {
    const payload = (await response.clone().json()) as Record<string, unknown>;
    const candidate = payload.error ?? payload.message;
    if (typeof candidate === "string" && candidate.trim()) {
      detail = candidate.trim();
    }
  } catch {
    // 响应体非 JSON 时忽略，使用状态码兜底。
  }
  throw new Error(detail || `Request failed: ${response.status}`);
}

export async function fetchJson<T>(path: string): Promise<T> {
  const response = await requestWithFriendlyError(`${API_BASE}${path}`);
  if (!response.ok) {
    await throwResponseError(response);
  }
  return response.json() as Promise<T>;
}

export async function postJson<T = unknown>(path: string, body?: unknown): Promise<T> {
  const response = await requestWithFriendlyError(`${API_BASE}${path}`, {
    method: "POST",
    headers: body === undefined ? undefined : { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body)
  });
  if (!response.ok) {
    await throwResponseError(response);
  }
  return response.json() as Promise<T>;
}

export async function listRuns(query: { taskId?: string; agentId?: string; status?: string } = {}): Promise<Run[]> {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value) {
      params.set(key, value);
    }
  }
  return fetchJson<Run[]>(`/runs${params.size > 0 ? `?${params.toString()}` : ""}`);
}

export async function getRunObservability(id: string): Promise<RunObservability> {
  return fetchJson<RunObservability>(`/runs/${encodeURIComponent(id)}/observability`);
}

export async function getRunRawLogs(id: string, query: RawLogQueryInput = {}): Promise<RunRawLogsResponse> {
  const params = new URLSearchParams();
  if (query.source && query.source !== "all") {
    params.set("source", query.source);
  }
  if (query.q) {
    params.set("q", query.q);
  }
  if (query.cursor) {
    params.set("cursor", query.cursor);
  }
  const suffix = params.size > 0 ? `?${params.toString()}` : "";
  return fetchJson<RunRawLogsResponse>(`/runs/${encodeURIComponent(id)}/raw-logs${suffix}`);
}
