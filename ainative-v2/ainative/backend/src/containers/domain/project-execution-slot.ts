export type SlotAccessMetadata = {
  hostIp?: string;
  hostPort?: number;
  containerPort?: number;
  previewUrl?: string | null;
  networkMode?: 'host' | 'bridge';
  coreMode?: 'preview' | 'core-only';
  previewConfigured?: boolean;
  previewFallbackUsed?: boolean;
  startupFailureSnapshot?: Array<{
    name: string;
    phase?: string;
    message?: string | null;
    exitCode?: number | null;
    updatedAt?: string | null;
  }> | null;
  startupFailureMessage?: string | null;
};

export class ProjectExecutionSlot {
  id!: string;
  projectId!: string;
  taskId!: string;
  containerId?: string | null;
  accessMetadata?: SlotAccessMetadata | null;
  claimedAt!: Date;
  expiresAt!: Date;
  heartbeatAt?: Date | null;
}
