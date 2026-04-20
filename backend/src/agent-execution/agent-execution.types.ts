import { AgentCliAdapterId } from './agent-cli/agent-cli-adapter.interface';

export type AgentExecutionConfig = {
  adapter: AgentCliAdapterId;
  command: string;
  args: string[];
  /** Host absolute path (logs / control plane). */
  cwd: string;
  /**
   * In-container cwd for `docker exec -w` when executing on the runner plane.
   * Host `cwd` stays separate so logs and guards keep host paths.
   */
  runnerContainerCwd?: string;
  env: Record<string, string>;
  agentToolConfigId?: string;
  agentToolConfigName?: string;
};

export type AgentExecutionContext = {
  taskId: string;
  nodeId: string;
  projectId: string;
  businessLineId: string;
};

export type AgentExecutionStreamCallbacks = {
  onPrepared?: (input: {
    adapter: AgentCliAdapterId;
    prompt: string;
    preparedAt: Date;
  }) => Promise<void> | void;
  onStdoutLine?: (line: string) => void;
  onStderrLine?: (line: string) => void;
  onStdoutChunk?: (chunk: string) => void;
  onStderrChunk?: (chunk: string) => void;
};

export type AgentExecutionResult = {
  success: boolean;
  interrupted: boolean;
  exitCode: number | null;
  signal: NodeJS.Signals | null;
  command: string;
  args: string[];
  cwd: string;
  durationMs: number;
  stdout: string;
  stderr: string;
  prompt: string;
  sessionId?: string | null;
  errorMessage?: string;
  clearPreviousSessionId?: boolean;
};
