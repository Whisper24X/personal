import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export enum TaskEnvironmentStatus {
  notStarted = 'not_started',
  starting = 'starting',
  ready = 'ready',
  failed = 'failed',
  stopping = 'stopping',
  stopped = 'stopped',
}

export enum TaskEnvironmentStage {
  workspacePreparing = 'workspace_preparing',
  slotClaiming = 'slot_claiming',
  containerStarting = 'container_starting',
  ready = 'ready',
  failed = 'failed',
  stopped = 'stopped',
}

export enum TaskEnvironmentStepStatus {
  pending = 'pending',
  inProgress = 'in_progress',
  done = 'done',
  error = 'error',
}

export class TaskEnvironmentStepDto {
  @ApiProperty({ type: String })
  key: string;

  @ApiProperty({ type: String })
  label: string;

  @ApiProperty({
    enum: TaskEnvironmentStepStatus,
    enumName: 'TaskEnvironmentStepStatus',
  })
  status: TaskEnvironmentStepStatus;

  @ApiPropertyOptional({ type: String, nullable: true })
  message?: string | null;
}

export class TaskEnvironmentRuntimeDto {
  @ApiPropertyOptional({ type: String, nullable: true })
  gitWorktree?: string | null;

  @ApiPropertyOptional({ type: String, nullable: true })
  containerId?: string | null;

  @ApiPropertyOptional({ type: String, nullable: true })
  previewAddress?: string | null;

  @ApiPropertyOptional({ type: String, nullable: true })
  baseUrl?: string | null;
}

export class TaskEnvironmentDto {
  @ApiProperty({
    enum: TaskEnvironmentStatus,
    enumName: 'TaskEnvironmentStatus',
  })
  status: TaskEnvironmentStatus;

  @ApiProperty({
    enum: TaskEnvironmentStage,
    enumName: 'TaskEnvironmentStage',
  })
  stage: TaskEnvironmentStage;

  @ApiProperty({ type: String })
  stageLabel: string;

  @ApiPropertyOptional({ type: String, nullable: true })
  message?: string | null;

  @ApiProperty({ type: Date })
  updatedAt: Date;

  @ApiPropertyOptional({ type: TaskEnvironmentRuntimeDto, nullable: true })
  runtime?: TaskEnvironmentRuntimeDto | null;

  @ApiProperty({ type: TaskEnvironmentStepDto, isArray: true })
  steps: TaskEnvironmentStepDto[];
}
