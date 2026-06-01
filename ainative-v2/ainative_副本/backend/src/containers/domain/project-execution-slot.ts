export type SlotAccessMetadata = {
  hostIp: string;
  hostPort: number;
  containerPort: number;
  previewUrl: string;
  networkMode: 'host' | 'bridge';
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
