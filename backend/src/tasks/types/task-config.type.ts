export type TaskConfig = Record<string, unknown> & {
  workflowTemplateId?: string | null;
  cliToolId?: string | null;
  agentToolConfigId?: string | null;
};

export type TaskNodeConfig = Record<string, unknown> & {
  cliToolId?: string | null;
  agentToolConfigId?: string | null;
};
