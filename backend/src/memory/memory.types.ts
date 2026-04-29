import type { MemoryRuntimeConfigSnapshot } from './memory-runtime.config';

export const DEFAULT_MEMORY_PLUGIN_ID = 'ainative.default';

export type MemoryIngestionJob = {
  kind: 'task_done';
  projectId: string;
  taskId: string;
  idempotencyKey: string;
  source?: { type: 'user' | 'script'; ref?: string };
};

export type MemorySegment = {
  id: string;
  sourceRef: { nodeId?: string; turnIndex?: number };
  text: string;
  charCount: number;
};

export type MemoryFactCategory =
  | 'preference'
  | 'convention'
  | 'decision'
  | 'incident'
  | 'glossary'
  | 'episodic';

export type MemoryFact = {
  category: MemoryFactCategory;
  text: string;
  confidence: number;
  dedup_key: string;
  suggested_path: string;
  suggested_heading?: string;
  keywords_for_retrieval?: string[];
  draft?: boolean;
  source_task_id?: string;
  source_node_id?: string;
  reject_reasons?: string[];
};

export type MemoryPatch = {
  path: string;
  heading_anchor: string;
  op: 'add' | 'replace' | 'delete';
  body_md: string;
  dedup_key: string;
};

export type MemoryHostLogger = {
  debug: (msg: string, ...args: unknown[]) => void;
  info: (msg: string, ...args: unknown[]) => void;
  warn: (msg: string, ...args: unknown[]) => void;
  error: (msg: string, ...args: unknown[]) => void;
  child: (meta: Record<string, unknown>) => MemoryHostLogger;
};

export type HostCapabilities = {
  logger: MemoryHostLogger;
  metrics: {
    increment: (name: string, tags?: Record<string, string>) => void;
  };
  writeDoc: (args: {
    projectId: string;
    relativePath: string;
    content: string;
    mode: 'create' | 'update';
  }) => Promise<void>;
  readDoc: (args: {
    projectId: string;
    relativePath: string;
  }) => Promise<string | null>;
  completeJson: (args: {
    modelHint?: string;
    system: string;
    user: string;
    maxOutputTokens?: number;
  }) => Promise<{ raw: string; parse: <T>() => T }>;
  getTaskWorkspaceMeta: (taskId: string) => Promise<{
    businessLineId: string;
    projectId: string;
    dataRootResolved: string;
    repositoryRoot: string | null;
  }>;
  redact: (text: string) => string;
  config: MemoryRuntimeConfigSnapshot;
  idempotentDone: (idempotencyKey: string) => Promise<boolean>;
  markIngestDone: (idempotencyKey: string) => Promise<void>;
};

export type MemoryInjectContext = {
  projectId: string;
  taskId: string;
  nodeId: string;
  taskTitle: string;
  nodeName: string;
  nodeTemplateId?: string | null;
  userIntentSummary: string;
  taskPromptExcerpt?: string;
  recentTurnsSummary?: string;
};

export interface MemoryIngestPlugin {
  readonly id: string;
  onTaskDone(job: MemoryIngestionJob, caps: HostCapabilities): Promise<void>;
}

export interface MemoryInjectPlugin {
  readonly id: string;
  build(
    ctx: MemoryInjectContext,
    caps: HostCapabilities,
  ): Promise<{ text: string; debug?: Record<string, unknown> }>;
}

export type TaskDoneIngestPayload = {
  job: MemoryIngestionJob;
};
