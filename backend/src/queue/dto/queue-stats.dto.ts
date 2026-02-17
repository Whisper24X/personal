import { ApiProperty } from '@nestjs/swagger';

export class QueueGlobalStatsDto {
  @ApiProperty({ type: Number })
  maxConcurrency: number;

  @ApiProperty({ type: Number })
  running: number;

  @ApiProperty({ type: Number })
  queued: number;

  @ApiProperty({ type: Number })
  inReview: number;

  @ApiProperty({ type: Number })
  done: number;

  @ApiProperty({ type: Number })
  availableSlots: number;

  @ApiProperty({ type: Number })
  saturationRate: number;

  @ApiProperty({ type: Number })
  staleRunning: number;

  @ApiProperty({ type: Number, nullable: true })
  dispatchLagSeconds?: number | null;

  @ApiProperty({ type: Number, nullable: true })
  workerHeartbeatSkew?: number | null;
}

export class ProjectQueueStatsDto {
  @ApiProperty({ type: String })
  projectId: string;

  @ApiProperty({ type: String })
  projectName: string;

  @ApiProperty({ type: Number })
  maxConcurrency: number;

  @ApiProperty({ type: Number })
  running: number;

  @ApiProperty({ type: Number })
  queued: number;

  @ApiProperty({ type: Number })
  inReview: number;

  @ApiProperty({ type: Number })
  done: number;
}

export class QueueStatsDto {
  @ApiProperty({ type: Date })
  generatedAt: Date;

  @ApiProperty({ type: QueueGlobalStatsDto })
  global: QueueGlobalStatsDto;

  @ApiProperty({ type: ProjectQueueStatsDto, isArray: true })
  projects: ProjectQueueStatsDto[];
}
