export class ProjectExecutionSlot {
  id!: string;
  projectId!: string;
  taskId!: string;
  containerId?: string | null;
  claimedAt!: Date;
  expiresAt!: Date;
  heartbeatAt?: Date | null;
}
