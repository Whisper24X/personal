import { ApiProperty } from '@nestjs/swagger';

export class StatusCountDto {
  @ApiProperty({ type: Number })
  todo: number;

  @ApiProperty({ type: Number })
  inProgress: number;

  @ApiProperty({ type: Number })
  inReview: number;

  @ApiProperty({ type: Number })
  done: number;
}

export class ObservabilityAlertDto {
  @ApiProperty({ type: String })
  level: 'info' | 'warn' | 'error';

  @ApiProperty({ type: String })
  code: string;

  @ApiProperty({ type: String })
  message: string;
}

export class ObservabilityMetricsDto {
  @ApiProperty({ type: Date })
  generatedAt: Date;

  @ApiProperty({ type: Number })
  totalProjects: number;

  @ApiProperty({ type: Number })
  totalTasks: number;

  @ApiProperty({ type: StatusCountDto })
  statusCounts: StatusCountDto;

  @ApiProperty({ type: Number, description: '0-100' })
  successRate: number;

  @ApiProperty({ type: Number, nullable: true })
  averageDurationMinutes?: number | null;

  @ApiProperty({ type: Number })
  queueLength: number;

  @ApiProperty({ type: Number })
  runningTasks: number;

  @ApiProperty({ type: Number })
  maxConcurrency: number;

  @ApiProperty({ type: Number, description: '0-100' })
  concurrencyUsage: number;

  @ApiProperty({ type: Number })
  staleRunning: number;

  @ApiProperty({ type: Number, nullable: true })
  dispatchLagSeconds?: number | null;

  @ApiProperty({ type: Number, nullable: true })
  workerHeartbeatSkew?: number | null;

  @ApiProperty({ type: ObservabilityAlertDto, isArray: true })
  alerts: ObservabilityAlertDto[];
}
