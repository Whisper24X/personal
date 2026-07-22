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

export enum TaskPreviewStatus {
  unavailable = 'unavailable',
  provisioning = 'provisioning',
  ready = 'ready',
  failed = 'failed',
}

export enum TaskEnvironmentCoreMode {
  preview = 'preview',
  coreOnly = 'core-only',
}

export enum TaskEnvironmentServicePhase {
  pending = 'pending',
  installing = 'installing',
  starting = 'starting',
  listening = 'listening',
  failed = 'failed',
  unknown = 'unknown',
}

export enum TaskEnvironmentDiagnosticStatus {
  passed = 'passed',
  failed = 'failed',
  skipped = 'skipped',
}

export enum TaskWorkspaceStatus {
  provisioning = 'provisioning',
  ready = 'ready',
  failed = 'failed',
}

export enum TaskWorkspaceSnapshotStatus {
  pending = 'pending',
  pushing = 'pushing',
  pushed = 'pushed',
  failed = 'failed',
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
}

export class TaskEnvironmentPreviewDto {
  @ApiPropertyOptional({ type: String, nullable: true })
  url?: string | null;

  @ApiProperty({
    enum: TaskPreviewStatus,
    enumName: 'TaskPreviewStatus',
  })
  status: TaskPreviewStatus;

  @ApiPropertyOptional({ type: Boolean })
  partial?: boolean;

  @ApiPropertyOptional({ type: String, nullable: true })
  reason?:
    | 'http-ready'
    | 'port-listening-only'
    | 'unavailable'
    | 'failed'
    | null;
}

export class TaskEnvironmentServiceStatusDto {
  @ApiProperty({ type: String })
  name: string;

  @ApiPropertyOptional({ type: Number, nullable: true })
  port?: number | null;

  @ApiProperty({
    enum: TaskEnvironmentServicePhase,
    enumName: 'TaskEnvironmentServicePhase',
  })
  phase: TaskEnvironmentServicePhase;

  @ApiPropertyOptional({ type: String, nullable: true })
  message?: string | null;

  @ApiPropertyOptional({ type: Number, nullable: true })
  exitCode?: number | null;

  @ApiPropertyOptional({ type: String, nullable: true })
  updatedAt?: string | null;

  @ApiPropertyOptional({ type: Boolean })
  isPrimaryPreview?: boolean;
}

export class TaskEnvironmentRouteDiagnosticDto {
  @ApiProperty({ type: String })
  path: string;

  @ApiPropertyOptional({ type: String, nullable: true })
  service?: string | null;

  @ApiPropertyOptional({ type: Number, nullable: true })
  port?: number | null;

  @ApiProperty({
    enum: TaskEnvironmentDiagnosticStatus,
    enumName: 'TaskEnvironmentDiagnosticStatus',
  })
  status: TaskEnvironmentDiagnosticStatus;

  @ApiPropertyOptional({ type: Number, nullable: true })
  statusCode?: number | null;

  @ApiPropertyOptional({ type: String, nullable: true })
  error?: string | null;
}

export class TaskEnvironmentStartupFailureDto {
  @ApiProperty({ type: TaskEnvironmentServiceStatusDto, isArray: true })
  services: TaskEnvironmentServiceStatusDto[];

  @ApiPropertyOptional({ type: String, nullable: true })
  lastError?: string | null;
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

  @ApiPropertyOptional({
    enum: TaskWorkspaceStatus,
    enumName: 'TaskWorkspaceStatus',
    nullable: true,
  })
  workspaceStatus?: TaskWorkspaceStatus | null;

  @ApiPropertyOptional({ type: String, nullable: true })
  workspaceError?: string | null;

  @ApiPropertyOptional({ type: String, nullable: true })
  workspaceStage?: string | null;

  @ApiPropertyOptional({ type: String, nullable: true })
  workspaceMessage?: string | null;

  @ApiPropertyOptional({
    enum: TaskWorkspaceSnapshotStatus,
    enumName: 'TaskWorkspaceSnapshotStatus',
    nullable: true,
  })
  workspaceSnapshotStatus?: TaskWorkspaceSnapshotStatus | null;

  @ApiPropertyOptional({ type: String, nullable: true })
  workspaceSnapshotError?: string | null;

  @ApiPropertyOptional({ type: String, nullable: true })
  workspaceSnapshotPushedAt?: string | null;

  @ApiPropertyOptional({ type: TaskEnvironmentRuntimeDto, nullable: true })
  runtime?: TaskEnvironmentRuntimeDto | null;

  @ApiProperty({ type: TaskEnvironmentPreviewDto })
  preview: TaskEnvironmentPreviewDto;

  @ApiPropertyOptional({
    enum: TaskEnvironmentCoreMode,
    enumName: 'TaskEnvironmentCoreMode',
    nullable: true,
  })
  coreMode?: TaskEnvironmentCoreMode | null;

  @ApiPropertyOptional({
    type: TaskEnvironmentServiceStatusDto,
    isArray: true,
    nullable: true,
  })
  serviceStatuses?: TaskEnvironmentServiceStatusDto[] | null;

  @ApiPropertyOptional({
    type: TaskEnvironmentRouteDiagnosticDto,
    isArray: true,
    nullable: true,
  })
  routeDiagnostics?: TaskEnvironmentRouteDiagnosticDto[] | null;

  @ApiPropertyOptional({
    type: TaskEnvironmentStartupFailureDto,
    nullable: true,
  })
  startupFailureSnapshot?: TaskEnvironmentStartupFailureDto | null;

  @ApiProperty({ type: TaskEnvironmentStepDto, isArray: true })
  steps: TaskEnvironmentStepDto[];
}
