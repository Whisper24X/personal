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
  earlyExitMarkerFileName?: string | null;
  earlyExitMarkerEnabled?: boolean | null;
  attachments?: TaskAttachmentConfig[] | null;
};

export type TaskNodeInput = Record<string, unknown> & {
  taskInput?: string | null;
  nodeInput?: string | null;
  earlyExitMarkerFileName?: string | null;
  earlyExitMarkerEnabled?: boolean | null;
};

export type TaskNodeConfig = Record<string, unknown> & {
  requiresApproval?: boolean | null;
  requiresArtifact?: boolean | null;
};

export type TaskNodeRuntime = Record<string, unknown> & {
  workerId?: string | null;
  leaseUntil?: string | null;
  heartbeatAt?: string | null;
  pendingUserMessage?: string | null;
};
