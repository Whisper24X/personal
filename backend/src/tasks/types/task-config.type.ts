export type TaskAttachmentConfig = {
  name: string;
  size: number;
  type: string;
  lastModified: number;
};

export type TaskLoopConfig = {
  enabled: boolean;
  loopCount: number;
  maxLoops: number;
};

export type TaskConfig = Record<string, unknown> & {
  workflowTemplateId?: string | null;
  agentCliId?: string | null;
  agentCliConfigId?: string | null;
  loopEnabled?: boolean | null;
  maxLoops?: number | null;
  attachments?: TaskAttachmentConfig[] | null;
};

export type TaskNodeInput = Record<string, unknown> & {
  taskInput?: string | null;
  nodeInput?: string | null;
};

export type TaskNodeRuntime = Record<string, unknown> & {
  workerId?: string | null;
  leaseUntil?: string | null;
  heartbeatAt?: string | null;
  pendingUserMessage?: string | null;
};
