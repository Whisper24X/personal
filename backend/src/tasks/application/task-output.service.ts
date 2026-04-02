import { Injectable } from '@nestjs/common';
import { promises as fs } from 'fs';
import path from 'path';
import { resolveAinativeDataRootDir } from '../../utils/workspace-paths';
import { Task } from '../domain/task';
import { TaskNode } from '../domain/task-node';
import { TaskLogLevel } from '../dto/task-log-level.enum';
import { TaskMessageDto, TaskMessageRole } from '../dto/task-message.dto';
import { AgentCliAdapterRegistry } from '../agent-cli/agent-cli-adapter.registry';
import { AgentCliAdapterId } from '../agent-cli/agent-cli-adapter.interface';

export type ReadNodeOutputMessagesMetrics = {
  outputPath: string | null;
  fileBytes: number;
  lineCount: number;
  recordCount: number;
  messageCount: number;
  statMs: number;
  cacheHit: boolean;
  readFileMs: number;
  splitLinesMs: number;
  trimFilterMs: number;
  parseMetadataMs: number;
  buildMessagesMs: number;
  totalMs: number;
  error?: string;
};

export type ReadNodeOutputMessagesResult = {
  messages: TaskMessageDto[];
  metrics: ReadNodeOutputMessagesMetrics;
};

type CachedNodeOutputMessagesEntry = {
  outputPath: string;
  size: number;
  mtimeMs: number;
  lineCount: number;
  recordCount: number;
  messages: TaskMessageDto[];
};

@Injectable()
export class TaskOutputService {
  private readonly defaultDataRootDir = path.resolve(
    resolveAinativeDataRootDir(),
  );
  private readonly maxNodeOutputMessageCacheEntries = 256;
  private readonly nodeOutputMessageCache = new Map<
    string,
    CachedNodeOutputMessagesEntry
  >();

  constructor(
    private readonly agentCliAdapterRegistry: AgentCliAdapterRegistry = new AgentCliAdapterRegistry(),
  ) {}

  async writeNodeOutputJsonl({
    task,
    node,
    output,
  }: {
    task: Task;
    node: TaskNode;
    output: Record<string, unknown>;
  }): Promise<string> {
    const outputPath = this.resolveNodeOutputPath(task, node);
    const serializedOutput = this.serializeNodeOutputJsonl(output);

    await fs.mkdir(path.dirname(outputPath), {
      recursive: true,
    });
    await fs.writeFile(outputPath, serializedOutput, 'utf-8');
    this.invalidateNodeOutputMessageCache(outputPath);

    return outputPath;
  }

  async clearNodeOutputJsonl({
    task,
    node,
  }: {
    task: Task;
    node: TaskNode;
  }): Promise<void> {
    const outputPath = this.resolveNodeOutputPath(task, node);

    await fs.mkdir(path.dirname(outputPath), {
      recursive: true,
    });
    await fs.writeFile(outputPath, '', 'utf-8');
    this.invalidateNodeOutputMessageCache(outputPath);
  }

  async appendNodeOutputJsonlLines({
    task,
    node,
    lines,
  }: {
    task: Task;
    node: TaskNode;
    lines: string[];
  }): Promise<number> {
    const normalizedLines = lines.flatMap((line) =>
      this.extractJsonLinesFromContent(line),
    );

    if (!normalizedLines.length) {
      return 0;
    }

    const outputPath = this.resolveNodeOutputPath(task, node);
    await fs.mkdir(path.dirname(outputPath), {
      recursive: true,
    });
    await fs.appendFile(outputPath, `${normalizedLines.join('\n')}\n`, 'utf-8');
    this.invalidateNodeOutputMessageCache(outputPath);

    return normalizedLines.length;
  }

  async appendNodeOutputJsonlRecords({
    task,
    node,
    records,
  }: {
    task: Task;
    node: TaskNode;
    records: Record<string, unknown>[];
  }): Promise<number> {
    const lines = records
      .filter((record) => record && !Array.isArray(record))
      .map((record) => JSON.stringify(record));

    if (!lines.length) {
      return 0;
    }

    return this.appendNodeOutputJsonlLines({
      task,
      node,
      lines,
    });
  }

  async removeNodeOutputFiles({
    task,
    node,
  }: {
    task: Task;
    node: TaskNode;
  }): Promise<void> {
    const outputPath = this.resolveNodeOutputPath(task, node);
    const outputDir = path.dirname(outputPath);

    await fs.rm(outputDir, {
      recursive: true,
      force: true,
    });
    this.invalidateNodeOutputMessageCache(outputPath);
  }

  serializeNodeOutputJsonl(output: Record<string, unknown>): string {
    const stdout =
      typeof output.stdout === 'string' && output.stdout.trim()
        ? output.stdout
        : null;
    const stdoutJsonlLines = stdout
      ? this.extractJsonLinesFromContent(stdout)
      : [];

    if (!stdoutJsonlLines.length) {
      return '';
    }

    return `${stdoutJsonlLines.join('\n')}\n`;
  }

  extractJsonLinesFromContent(content: string): string[] {
    return content
      .split(/\r?\n/)
      .flatMap((line) => this.extractJsonCandidatesFromLine(line));
  }

  async readNodeOutputSummary(node: TaskNode): Promise<string | null> {
    const agentClioutput = this.normalizeOptionalString(node.agentClioutput);

    if (!agentClioutput) {
      return null;
    }

    try {
      const content = await fs.readFile(agentClioutput, 'utf-8');
      const records = content
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter(Boolean);

      for (let index = records.length - 1; index >= 0; index -= 1) {
        try {
          const parsed = JSON.parse(records[index]) as Record<string, unknown>;
          if (typeof parsed.summary === 'string' && parsed.summary.trim()) {
            return parsed.summary.trim();
          }
        } catch {
          continue;
        }
      }

      const fallbackSummary = records.join('\n').trim();
      if (fallbackSummary) {
        return fallbackSummary.length > 2_000
          ? fallbackSummary.slice(0, 2_000)
          : fallbackSummary;
      }
    } catch {
      return null;
    }

    return null;
  }

  async readNodeOutputMessages(
    task: Task,
    node: TaskNode,
  ): Promise<TaskMessageDto[]> {
    const result = await this.readNodeOutputMessagesWithMetrics(task, node);
    return result.messages;
  }

  async readNodeOutputMessagesWithMetrics(
    task: Task,
    node: TaskNode,
  ): Promise<ReadNodeOutputMessagesResult> {
    const totalStartedAt = process.hrtime.bigint();
    const outputPath = this.resolveReadableNodeOutputPath(task, node);

    if (!outputPath) {
      return {
        messages: [],
        metrics: {
          outputPath: null,
          fileBytes: 0,
          lineCount: 0,
          recordCount: 0,
          messageCount: 0,
          statMs: 0,
          cacheHit: false,
          readFileMs: 0,
          splitLinesMs: 0,
          trimFilterMs: 0,
          parseMetadataMs: 0,
          buildMessagesMs: 0,
          totalMs: this.elapsedMs(totalStartedAt),
          error: 'missing_output_path',
        },
      };
    }

    try {
      const statStartedAt = process.hrtime.bigint();
      const stat = await fs.stat(outputPath);
      const statMs = this.elapsedMs(statStartedAt);
      const cachedEntry = this.nodeOutputMessageCache.get(outputPath);

      if (
        cachedEntry &&
        cachedEntry.size === stat.size &&
        cachedEntry.mtimeMs === stat.mtimeMs
      ) {
        this.touchNodeOutputMessageCache(outputPath, cachedEntry);

        return {
          messages: cachedEntry.messages,
          metrics: {
            outputPath,
            fileBytes: cachedEntry.size,
            lineCount: cachedEntry.lineCount,
            recordCount: cachedEntry.recordCount,
            messageCount: cachedEntry.messages.length,
            statMs,
            cacheHit: true,
            readFileMs: 0,
            splitLinesMs: 0,
            trimFilterMs: 0,
            parseMetadataMs: 0,
            buildMessagesMs: 0,
            totalMs: this.elapsedMs(totalStartedAt),
          },
        };
      }

      const readFileStartedAt = process.hrtime.bigint();
      const content = await fs.readFile(outputPath, 'utf-8');
      const readFileMs = this.elapsedMs(readFileStartedAt);

      const splitLinesStartedAt = process.hrtime.bigint();
      const lines = content.split(/\r?\n/);
      const splitLinesMs = this.elapsedMs(splitLinesStartedAt);

      const trimFilterStartedAt = process.hrtime.bigint();
      const records = lines.map((line) => line.trim()).filter(Boolean);
      const trimFilterMs = this.elapsedMs(trimFilterStartedAt);

      const fallbackTimeMs = (
        node.startedAt ??
        node.finishedAt ??
        node.createdAt ??
        task.createdAt ??
        new Date()
      ).getTime();

      const parseMetadataStartedAt = process.hrtime.bigint();
      const parsedRecords = records.map((line, index) => ({
        line,
        index,
        metadata: this.resolveNodeOutputMessageMetadata(
          line,
          this.resolveAdapterId(node),
        ),
      }));
      const parseMetadataMs = this.elapsedMs(parseMetadataStartedAt);

      const buildMessagesStartedAt = process.hrtime.bigint();
      const messages = parsedRecords.flatMap(({ line, index, metadata }) => {
        if (!metadata) {
          return [];
        }

        return [
          {
            role: metadata.role,
            content: line,
            createdAt: new Date(metadata.createdAtMs ?? fallbackTimeMs + index),
            taskNodeId: node.id,
            level:
              metadata.role === TaskMessageRole.error
                ? TaskLogLevel.error
                : TaskLogLevel.info,
          },
        ];
      });
      const buildMessagesMs = this.elapsedMs(buildMessagesStartedAt);
      this.setNodeOutputMessageCache({
        outputPath,
        size: stat.size,
        mtimeMs: stat.mtimeMs,
        lineCount: lines.length,
        recordCount: records.length,
        messages,
      });

      return {
        messages,
        metrics: {
          outputPath,
          fileBytes: stat.size,
          lineCount: lines.length,
          recordCount: records.length,
          messageCount: messages.length,
          statMs,
          cacheHit: false,
          readFileMs,
          splitLinesMs,
          trimFilterMs,
          parseMetadataMs,
          buildMessagesMs,
          totalMs: this.elapsedMs(totalStartedAt),
        },
      };
    } catch (error) {
      return {
        messages: [],
        metrics: {
          outputPath,
          fileBytes: 0,
          lineCount: 0,
          recordCount: 0,
          messageCount: 0,
          statMs: 0,
          cacheHit: false,
          readFileMs: 0,
          splitLinesMs: 0,
          trimFilterMs: 0,
          parseMetadataMs: 0,
          buildMessagesMs: 0,
          totalMs: this.elapsedMs(totalStartedAt),
          error: error instanceof Error ? error.message : String(error),
        },
      };
    }
  }

  resolveNodeOutputPath(task: Task, node: TaskNode): string {
    return path.resolve(
      this.defaultDataRootDir,
      task.businessLineId?.trim() || 'unknown-business-line',
      'projects',
      task.projectId?.trim() || 'unknown-project',
      'tasks',
      task.id,
      'nodes',
      node.id,
      'output.jsonl',
    );
  }

  private extractJsonCandidatesFromLine(line: string): string[] {
    const trimmed = line.trim();
    if (!trimmed) {
      return [];
    }

    if (this.isJsonLine(trimmed)) {
      return [trimmed];
    }

    const candidates: string[] = [];

    for (let index = 0; index < trimmed.length; index += 1) {
      const marker = trimmed[index];
      if (marker !== '{' && marker !== '[') {
        continue;
      }

      const candidate = trimmed.slice(index).trim();
      if (!candidate || !this.isJsonLine(candidate)) {
        continue;
      }

      candidates.push(candidate);
      break;
    }

    return candidates;
  }

  private isJsonLine(value: string): boolean {
    try {
      JSON.parse(value);
      return true;
    } catch {
      return false;
    }
  }

  private resolveReadableNodeOutputPath(task: Task, node: TaskNode): string {
    return (
      this.normalizeOptionalString(node.agentClioutput) ??
      this.resolveNodeOutputPath(task, node)
    );
  }

  private elapsedMs(startedAt: bigint): number {
    return (
      Math.round(
        (Number(process.hrtime.bigint() - startedAt) / 1_000_000) * 10,
      ) / 10
    );
  }

  private invalidateNodeOutputMessageCache(outputPath: string): void {
    this.nodeOutputMessageCache.delete(outputPath);
  }

  private touchNodeOutputMessageCache(
    outputPath: string,
    entry: CachedNodeOutputMessagesEntry,
  ): void {
    this.nodeOutputMessageCache.delete(outputPath);
    this.nodeOutputMessageCache.set(outputPath, entry);
  }

  private setNodeOutputMessageCache(
    entry: CachedNodeOutputMessagesEntry,
  ): void {
    this.nodeOutputMessageCache.delete(entry.outputPath);
    this.nodeOutputMessageCache.set(entry.outputPath, entry);

    while (
      this.nodeOutputMessageCache.size > this.maxNodeOutputMessageCacheEntries
    ) {
      const oldestKey = this.nodeOutputMessageCache.keys().next().value;
      if (!oldestKey) {
        break;
      }
      this.nodeOutputMessageCache.delete(oldestKey);
    }
  }

  private resolveNodeOutputMessageMetadata(
    line: string,
    adapterId?: AgentCliAdapterId | null,
  ): { role: TaskMessageRole; createdAtMs?: number } | null {
    const record = this.tryParseNodeOutputRecord(line);

    if (!record) {
      return {
        role: TaskMessageRole.system,
      };
    }

    const createdAt = this.resolveNodeOutputRecordDate(record);

    return {
      role: this.resolveNodeOutputRecordRole(record, adapterId),
      createdAtMs: createdAt?.getTime(),
    };
  }

  private tryParseNodeOutputRecord(
    line: string,
  ): Record<string, unknown> | null {
    try {
      const parsed = JSON.parse(line) as unknown;
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
        return null;
      }

      return parsed as Record<string, unknown>;
    } catch {
      return null;
    }
  }

  private resolveNodeOutputRecordRole(
    record: Record<string, unknown>,
    adapterId?: AgentCliAdapterId | null,
  ): TaskMessageRole {
    if (adapterId) {
      return this.agentCliAdapterRegistry
        .getById(adapterId)
        .classifyMessageRole(record);
    }

    const descriptors = this.collectNodeOutputDescriptors(record);

    if (
      descriptors.some((descriptor) => {
        return descriptor === 'user' || descriptor === 'user_message';
      })
    ) {
      return TaskMessageRole.user;
    }

    if (
      descriptors.some((descriptor) => {
        return (
          descriptor === 'assistant' ||
          descriptor === 'assistant_message' ||
          descriptor === 'agent_message' ||
          descriptor === 'agent_message_delta' ||
          descriptor === 'model'
        );
      })
    ) {
      return TaskMessageRole.assistant;
    }

    if (
      descriptors.some((descriptor) => {
        return (
          descriptor === 'error' ||
          descriptor.endsWith('_error') ||
          descriptor.includes('error')
        );
      })
    ) {
      return TaskMessageRole.error;
    }

    if (record.is_error === true) {
      return TaskMessageRole.error;
    }

    return TaskMessageRole.system;
  }

  private resolveAdapterId(node: TaskNode): AgentCliAdapterId | null {
    const rawAdapterId = this.normalizeOptionalString(node.agentCliId);

    return rawAdapterId
      ? this.agentCliAdapterRegistry.resolve(rawAdapterId)
      : null;
  }

  private collectNodeOutputDescriptors(
    record: Record<string, unknown>,
  ): string[] {
    const descriptors = new Set<string>();
    const queue: Array<{ value: Record<string, unknown>; depth: number }> = [
      { value: record, depth: 0 },
    ];

    while (queue.length > 0) {
      const current = queue.shift();

      if (!current) {
        continue;
      }

      if (current.depth > 2) {
        continue;
      }

      ['type', 'event', 'method', 'kind', 'role', 'subtype'].forEach((key) => {
        const value = current.value[key];
        if (typeof value === 'string' && value.trim()) {
          descriptors.add(value.trim().toLowerCase().replace(/\./g, '_'));
        }
      });

      ['item', 'message', 'params', 'result', 'event'].forEach((key) => {
        const nested = current.value[key];
        if (nested && typeof nested === 'object' && !Array.isArray(nested)) {
          queue.push({
            value: nested as Record<string, unknown>,
            depth: current.depth + 1,
          });
        }
      });
    }

    return [...descriptors];
  }

  private resolveNodeOutputRecordDate(
    record: Record<string, unknown>,
  ): Date | null {
    const timestampMs = this.normalizeTimestampNumber(record.timestamp_ms);
    if (timestampMs !== null) {
      return new Date(timestampMs);
    }

    const timestamp = this.normalizeTimestampNumber(record.timestamp);
    if (timestamp !== null) {
      return new Date(timestamp);
    }

    const directDateCandidates = [
      record.createdAt,
      record.created_at,
      record.updatedAt,
      record.updated_at,
      record.time,
      record.ts,
    ];

    for (const candidate of directDateCandidates) {
      const parsed = this.parseOptionalDateLike(candidate);
      if (parsed) {
        return parsed;
      }
    }

    return null;
  }

  private normalizeTimestampNumber(value: unknown): number | null {
    if (typeof value !== 'number' || Number.isNaN(value)) {
      return null;
    }

    if (value < 100_000_000_000) {
      return value * 1_000;
    }

    return value;
  }

  private parseOptionalDateLike(value: unknown): Date | null {
    if (typeof value === 'number' && !Number.isNaN(value)) {
      return new Date(this.normalizeTimestampNumber(value) ?? value);
    }

    if (typeof value !== 'string') {
      return null;
    }

    const trimmed = value.trim();
    if (!trimmed) {
      return null;
    }

    const numericValue = Number(trimmed);
    if (!Number.isNaN(numericValue)) {
      const normalized = this.normalizeTimestampNumber(numericValue);
      return normalized === null ? null : new Date(normalized);
    }

    const parsed = new Date(trimmed);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }

  private normalizeOptionalString(value?: string | null): string | null {
    if (value === undefined || value === null) {
      return null;
    }

    const normalized = value.trim();
    return normalized || null;
  }
}
