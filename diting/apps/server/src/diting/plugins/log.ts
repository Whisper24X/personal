import { appendFile, mkdir, readdir, readFile } from "node:fs/promises";
import { resolve, join } from "node:path";
import {
  ExecutionLogRecord,
  LogEntry,
  LogPlugin,
  ObservabilityEvent,
  PluginHealth,
  RawLogQuery,
  RawLogReadResult,
  RunRawLogItem,
  RunStageKey
} from "@diting/plugin-api";

type StoredLogEntry = Omit<LogEntry, "createdAt"> & { createdAt: string };

export class RootLogsPlugin implements LogPlugin {
  readonly id = "root-logs";
  readonly kind = "log" as const;
  readonly priority = 100;
  readonly capabilities = ["default"];

  private readonly listeners = new Set<(event: ObservabilityEvent) => void>();
  private readonly recent: ObservabilityEvent[] = [];
  private readonly root = resolve(process.cwd(), "logs");

  async health(): Promise<PluginHealth> {
    return { healthy: true, message: `Root file log plugin active: ${this.root}` };
  }

  async init(): Promise<void> {
    await mkdir(this.root, { recursive: true });
    await mkdir(join(this.root, "system"), { recursive: true });
    await mkdir(join(this.root, "tasks"), { recursive: true });
    await mkdir(join(this.root, "traces"), { recursive: true });
  }

  async append(entry: LogEntry): Promise<void> {
    await this.ensurePaths(entry);
    const stored = serializeEntry(entry);
    const line = `${JSON.stringify(stored)}\n`;
    const writes = [appendFile(systemLogPath(this.root), line, "utf8")];
    if (entry.taskId) {
      writes.push(appendFile(taskLogPath(this.root, entry.taskId), line, "utf8"));
    }
    if (entry.traceId) {
      writes.push(appendFile(traceLogPath(this.root, entry.traceId), line, "utf8"));
    }
    if (entry.taskId && entry.executionId) {
      writes.push(appendFile(executionLogPath(this.root, entry.taskId, entry.executionId), line, "utf8"));
    }
    if (entry.taskId && entry.executionId && isExecutorChannel(entry.channel)) {
      writes.push(appendFile(executorOutputPath(this.root, entry.taskId, entry.executionId, entry.channel), formatRawLog(entry), "utf8"));
    }
    await Promise.all(writes);

    if (entry.channel === "event") {
      const event = toObservabilityEvent(entry);
      this.recent.push(event);
      if (this.recent.length > 200) {
        this.recent.shift();
      }
      for (const listener of this.listeners) {
        listener(event);
      }
    }
  }

  async listByTask(taskId: string, limit = 500): Promise<ExecutionLogRecord[]> {
    return readExecutionLogFile(taskLogPath(this.root, taskId), limit);
  }

  async listByTrace(traceId: string, limit = 500): Promise<ExecutionLogRecord[]> {
    return readExecutionLogFile(traceLogPath(this.root, traceId), limit);
  }

  async listByExecution(executionId: string): Promise<ExecutionLogRecord[]> {
    const tasksDir = join(this.root, "tasks");
    try {
      const taskIds = await readdir(tasksDir);
      for (const taskId of taskIds) {
        const logs = await readExecutionLogFile(executionLogPath(this.root, taskId, executionId), 5_000);
        if (logs.length > 0) {
          return logs;
        }
      }
    } catch {
      return [];
    }
    return [];
  }

  async listRawByExecution(query: RawLogQuery): Promise<RawLogReadResult> {
    const limit = Math.min(Math.max(query.limit ?? 200, 1), 500);
    const inferredPluginId = await this.resolveExecutionPluginId(query.taskId, query.executionId);
    const sources = query.source
      ? [query.source]
      : (["stdout", "stderr", "summary", "event", "file"] as const);
    const items: RunRawLogItem[] = [];

    for (const source of sources) {
      if (source === "event" || source === "file") {
        const structured = await readExecutionLogFile(
          executionLogPath(this.root, query.taskId, query.executionId),
          5_000
        );
        for (const [index, log] of structured.entries()) {
          items.push({
            id: `${query.executionId}:${source}:${index + 1}`,
            runId: query.executionId,
            taskId: query.taskId,
            source,
            channel: source === "event" ? "event" : "file",
            stage: inferRawLogStage(log.eventType),
            pluginId: readLogPluginId(log),
            createdAt: log.createdAt,
            text: log.message,
            redacted: true
          });
        }
        continue;
      }

      const channel = source === "stdout"
        ? "executor_stdout"
        : source === "stderr"
          ? "executor_stderr"
          : "executor_summary";
      const rawEntries = await this.readExecutorRawEntries(query.taskId, query.executionId, channel);
      for (const [index, entry] of rawEntries.entries()) {
        items.push({
          id: `${query.executionId}:${source}:${index + 1}`,
          runId: query.executionId,
          taskId: query.taskId,
          source,
          channel,
          stage: inferRawLogStage(entry.eventType) ?? "execute",
          pluginId: entry.pluginId ?? inferredPluginId,
          createdAt: entry.createdAt,
          text: entry.text,
          redacted: true
        });
      }
    }

    const filtered = items.filter((item) => (
      query.q ? item.text.toLowerCase().includes(query.q.toLowerCase()) : true
    ));
    const startIndex = decodeRawLogCursor(query.cursor);
    const window = filtered.slice(startIndex, startIndex + limit);
    const nextIndex = startIndex + window.length;
    return {
      scope: "run",
      redacted: true,
      items: window,
      nextCursor: nextIndex < filtered.length ? encodeRawLogCursor(nextIndex) : null
    };
  }

  async recentEvents(limit = 200): Promise<ObservabilityEvent[]> {
    return this.snapshotEvents(limit);
  }

  snapshotEvents(limit = 200): ObservabilityEvent[] {
    return this.recent.slice(-limit);
  }

  subscribe(listener: (event: ObservabilityEvent) => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private async resolveExecutionStartedAt(taskId: string, executionId: string): Promise<Date> {
    const logs = await readExecutionLogFile(executionLogPath(this.root, taskId, executionId), 1);
    return logs[0]?.createdAt ?? new Date();
  }

  private async readExecutorRawEntries(
    taskId: string,
    executionId: string,
    channel: LogEntry["channel"]
  ): Promise<Array<{ createdAt: Date; eventType: string; pluginId: string | null; text: string }>> {
    const storedEntries = await readStoredLogFile(executionLogPath(this.root, taskId, executionId));
    const structuredRawEntries = storedEntries
      .filter((entry) => entry.channel === channel)
      .slice(-5_000)
      .flatMap((entry) => readRawLines(entry).map((text) => ({
        createdAt: new Date(entry.createdAt),
        eventType: entry.eventType,
        pluginId: typeof entry.pluginId === "string" ? entry.pluginId : null,
        text
      })));
    if (structuredRawEntries.length > 0) {
      return structuredRawEntries;
    }

    const startedAt = await this.resolveExecutionStartedAt(taskId, executionId);
    const rawLines = await readRawExecutorLines(executorOutputPath(this.root, taskId, executionId, channel));
    return rawLines.map((text) => ({
      createdAt: startedAt,
      eventType: channel,
      pluginId: null,
      text
    }));
  }

  private async resolveExecutionPluginId(taskId: string, executionId: string): Promise<string | null> {
    const logs = await readExecutionLogFile(executionLogPath(this.root, taskId, executionId), 100);
    for (const log of logs) {
      const pId = readLogPluginId(log);
      if (pId) {
        return pId;
      }
    }
    return null;
  }

  private async ensurePaths(entry: LogEntry): Promise<void> {
    await mkdir(join(this.root, "system"), { recursive: true });
    if (entry.taskId) {
      await mkdir(join(this.root, "tasks", entry.taskId, "executor"), { recursive: true });
    }
    if (entry.traceId) {
      await mkdir(join(this.root, "traces", entry.traceId), { recursive: true });
    }
  }

}

function serializeEntry(entry: LogEntry): StoredLogEntry {
  return {
    ...entry,
    createdAt: entry.createdAt.toISOString()
  };
}

function toObservabilityEvent(entry: LogEntry): ObservabilityEvent {
  return {
    id: entry.id,
    schemaVersion: "2026-05-11",
    traceId: entry.traceId ?? "system",
    taskId: entry.taskId,
    executionId: entry.executionId ?? undefined,
    pluginId: entry.pluginId,
    agentId: entry.agentId,
    eventType: entry.eventType,
    message: entry.message,
    data: entry.data,
    createdAt: entry.createdAt
  };
}

async function readExecutionLogFile(path: string, limit: number): Promise<ExecutionLogRecord[]> {
  try {
    return (await readStoredLogFile(path))
      .filter((entry) => entry.channel === "execution_log")
      .slice(-limit)
      .map((entry) => ({
        id: entry.id,
        taskId: entry.taskId ?? "",
        executionId: entry.executionId ?? null,
        eventType: entry.eventType,
        message: entry.message,
        data: entry.data,
        createdAt: new Date(entry.createdAt)
      }));
  } catch {
    return [];
  }
}

async function readStoredLogFile(path: string): Promise<StoredLogEntry[]> {
  try {
    const raw = await readFile(path, "utf8");
    return raw
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => JSON.parse(line) as StoredLogEntry);
  } catch {
    return [];
  }
}

function isExecutorChannel(channel: LogEntry["channel"]): boolean {
  return channel === "executor_stdout" || channel === "executor_stderr" || channel === "executor_summary";
}

function systemLogPath(root: string): string {
  return join(root, "system", "system.log");
}

function taskLogPath(root: string, taskId: string): string {
  return join(root, "tasks", taskId, "task.log");
}

function traceLogPath(root: string, traceId: string): string {
  return join(root, "traces", traceId, "trace.log");
}

function executionLogPath(root: string, taskId: string, executionId: string): string {
  return join(root, "tasks", taskId, `execution-${executionId}.log`);
}

function executorOutputPath(root: string, taskId: string, executionId: string, channel: LogEntry["channel"]): string {
  const suffix = channel === "executor_stdout"
    ? "stdout"
    : channel === "executor_stderr"
      ? "stderr"
      : "summary";
  return join(root, "tasks", taskId, "executor", `${executionId}-${suffix}.log`);
}

function formatRawLog(entry: LogEntry): string {
  const raw = typeof entry.data.raw === "string" ? entry.data.raw : entry.message;
  return raw.endsWith("\n") ? raw : `${raw}\n`;
}

function readRawLines(entry: StoredLogEntry): string[] {
  const raw = typeof entry.data.raw === "string" ? entry.data.raw : entry.message;
  return raw
    .split("\n")
    .map((line) => line.trimEnd())
    .filter((line) => line.length > 0);
}

async function readRawExecutorLines(path: string): Promise<string[]> {
  try {
    const raw = await readFile(path, "utf8");
    return raw
      .split("\n")
      .map((line) => line.trimEnd())
      .filter((line) => line.length > 0);
  } catch {
    return [];
  }
}

function readLogPluginId(log: ExecutionLogRecord): string | null {
  const correlation = log.data?.correlation;
  if (!correlation || typeof correlation !== "object") {
    return null;
  }
  const pluginId = (correlation as Record<string, unknown>).pluginId;
  return typeof pluginId === "string" ? pluginId : null;
}

function inferRawLogStage(eventType: string): RunStageKey | null {
  const lower = eventType.toLowerCase();
  if (lower.includes("workspace") || lower.includes("environment") || lower.includes("preparing")) {
    return "workspace";
  }
  if (lower.includes("executor") || lower.includes("executing")) {
    return "execute";
  }
  if (lower.includes("quality") || lower.includes("eval")) {
    return "quality";
  }
  if (lower.includes("repair") || lower.includes("goal")) {
    return "repair";
  }
  if (lower.includes("pull_request") || lower.includes("pull request")) {
    return "pull_request";
  }
  if (lower.includes("completed") || lower.includes("done")) {
    return "done";
  }
  return null;
}

function encodeRawLogCursor(index: number): string {
  return Buffer.from(String(index), "utf8").toString("base64");
}

function decodeRawLogCursor(cursor?: string): number {
  if (!cursor) {
    return 0;
  }
  try {
    const decoded = Buffer.from(cursor, "base64").toString("utf8");
    const index = Number.parseInt(decoded, 10);
    return Number.isFinite(index) && index >= 0 ? index : 0;
  } catch {
    return 0;
  }
}

