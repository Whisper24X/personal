export type TaskAttachmentConfig = {
  name: string;
  size: number;
  type: string;
  lastModified: number;
};

export type TaskConfig = Record<string, unknown> & {
  workflowTemplateId?: string | null;
  cliToolId?: string | null;
  agentToolConfigId?: string | null;
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
};
