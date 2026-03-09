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

export type TaskNodeConfig = Record<string, unknown> & {
  cliToolId?: string | null;
  agentToolConfigId?: string | null;
};
