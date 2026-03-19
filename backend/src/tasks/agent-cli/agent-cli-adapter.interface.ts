import { TaskMessageRole } from '../dto/task-message.dto';

export type AgentCliAdapterId =
  | 'codex'
  | 'cursor'
  | 'claude'
  | 'gemini'
  | 'opencode';

export type AgentCliRunnerConfigInput = {
  command?: string;
  args?: string[];
  env?: Record<string, string>;
};

export type AgentCliContinuationOptions = {
  sessionId: string;
  continuationConfig: Record<string, unknown>;
};

export type AgentCliPreExecutionOutputInput = {
  prompt: string;
  createdAt: Date;
};

export interface AgentCliAdapter {
  readonly id: AgentCliAdapterId;
  readonly toolIdAliases: string[];
  readonly toolConfigAllowedKeys: ReadonlySet<string>;
  readonly defaultCommand: string;
  readonly runnerCommandEnvKey: string;

  buildToolRunnerConfig(
    raw: Record<string, unknown>,
  ): AgentCliRunnerConfigInput;
  defaultArgs(): string[];
  normalizeArgs(args: string[]): string[];
  applyContinuation(
    args: string[],
    options: AgentCliContinuationOptions,
  ): string[];
  buildPreExecutionOutputRecords(
    input: AgentCliPreExecutionOutputInput,
  ): Record<string, unknown>[];
  extractSessionId(content: string): string | null;
  classifyMessageRole(record: Record<string, unknown>): TaskMessageRole;
}
