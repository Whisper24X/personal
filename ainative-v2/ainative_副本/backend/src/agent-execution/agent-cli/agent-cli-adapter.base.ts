import { TaskMessageRole } from '../../tasks/dto/task-message.dto';
import {
  AgentCliAdapter,
  AgentCliContinuationOptions,
  AgentCliPreExecutionOutputInput,
  AgentCliRunnerConfigInput,
} from './agent-cli-adapter.interface';

export abstract class BaseAgentCliAdapter implements AgentCliAdapter {
  abstract readonly id: AgentCliAdapter['id'];
  abstract readonly toolIdAliases: string[];
  abstract readonly toolConfigAllowedKeys: ReadonlySet<string>;
  abstract readonly defaultCommand: string;
  abstract readonly runnerCommandEnvKey: string;

  abstract buildToolRunnerConfig(
    raw: Record<string, unknown>,
  ): AgentCliRunnerConfigInput;

  defaultArgs(): string[] {
    return [];
  }

  normalizeArgs(args: string[]): string[] {
    return [...args];
  }

  applyContinuation(
    args: string[],
    options: AgentCliContinuationOptions,
  ): string[] {
    void options;
    return [...args];
  }

  buildPreExecutionOutputRecords(
    input: AgentCliPreExecutionOutputInput,
  ): Record<string, unknown>[] {
    void input;
    return [];
  }

  extractSessionId(content: string): string | null {
    const normalized = this.normalizeOptionalString(content);
    if (!normalized) {
      return null;
    }

    const jsonMatch = this.extractSessionIdFromJson(normalized);
    if (jsonMatch) {
      return jsonMatch;
    }

    const textMatch =
      /(?:session|conversation|thread|chat)[_ -]?id["'=: ]+([A-Za-z0-9._:-]+)/i.exec(
        normalized,
      );

    return textMatch?.[1] ?? null;
  }

  classifyMessageRole(record: Record<string, unknown>): TaskMessageRole {
    const descriptors = this.collectDescriptors(record);

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

  protected resolveStringArray(value: unknown): string[] | undefined {
    if (!Array.isArray(value)) {
      return undefined;
    }

    const parsed = value
      .filter((item) => typeof item === 'string')
      .map((item) => String(item).trim())
      .filter(Boolean);

    return parsed.length ? parsed : undefined;
  }

  protected resolveStringEnv(
    input: Record<string, unknown> | Record<string, string>,
  ): Record<string, string> {
    return Object.entries(input).reduce<Record<string, string>>(
      (result, [key, value]) => {
        if (typeof value === 'string') {
          result[key] = value;
        }
        return result;
      },
      {},
    );
  }

  protected normalizeOptionalString(value?: string | null): string | null {
    if (value === undefined || value === null) {
      return null;
    }

    const normalized = value.trim();
    return normalized || null;
  }

  private extractSessionIdFromJson(content: string): string | null {
    try {
      const parsed = JSON.parse(content) as unknown;
      return this.findSessionIdInValue(parsed);
    } catch {
      return null;
    }
  }

  private findSessionIdInValue(value: unknown): string | null {
    if (!value || typeof value !== 'object') {
      return null;
    }

    if (Array.isArray(value)) {
      for (const item of value) {
        const found = this.findSessionIdInValue(item);
        if (found) {
          return found;
        }
      }

      return null;
    }

    const record = value as Record<string, unknown>;
    const candidateKeys = [
      'session_id',
      'sessionId',
      'conversation_id',
      'conversationId',
      'thread_id',
      'threadId',
      'chat_id',
      'chatId',
    ];

    for (const key of candidateKeys) {
      if (typeof record[key] === 'string' && record[key].trim()) {
        return record[key].trim();
      }
    }

    for (const nestedValue of Object.values(record)) {
      const found = this.findSessionIdInValue(nestedValue);
      if (found) {
        return found;
      }
    }

    return null;
  }

  private collectDescriptors(record: Record<string, unknown>): string[] {
    const descriptors = new Set<string>();
    const queue: Array<{ value: Record<string, unknown>; depth: number }> = [
      { value: record, depth: 0 },
    ];

    while (queue.length > 0) {
      const current = queue.shift();

      if (!current || current.depth > 2) {
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
}
