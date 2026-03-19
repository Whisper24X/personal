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

@Injectable()
export class TaskOutputService {
  private readonly defaultDataRootDir = path.resolve(
    resolveAinativeDataRootDir(),
  );

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

    return normalizedLines.length;
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
    const outputPath = this.resolveReadableNodeOutputPath(task, node);

    if (!outputPath) {
      return [];
    }

    try {
      const content = await fs.readFile(outputPath, 'utf-8');
      const records = content
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter(Boolean);

      const fallbackTimeMs = (
        node.startedAt ??
        node.finishedAt ??
        node.createdAt ??
        task.createdAt ??
        new Date()
      ).getTime();

      return records.flatMap((line, index) => {
        const metadata = this.resolveNodeOutputMessageMetadata(
          line,
          this.resolveAdapterId(node),
        );

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
    } catch {
      return [];
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
