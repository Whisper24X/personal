import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsNotEmpty, IsOptional, IsString, Max, Min } from 'class-validator';

export enum TaskTerminalSessionStatus {
  running = 'running',
  stopped = 'stopped',
  error = 'error',
}

export class CreateTaskTerminalSessionDto {
  @ApiPropertyOptional({ type: String })
  @IsOptional()
  @IsString()
  shell?: string;

  @ApiPropertyOptional({ type: Number, default: 80 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(500)
  cols?: number;

  @ApiPropertyOptional({ type: Number, default: 24 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(200)
  rows?: number;
}

export class TaskTerminalInputDto {
  @ApiProperty({ type: String })
  @IsString()
  @IsNotEmpty()
  input: string;
}

export class TaskTerminalSessionDto {
  @ApiProperty({ type: String })
  id: string;

  @ApiProperty({ type: String })
  taskId: string;

  @ApiProperty({ type: String })
  cwd: string;

  @ApiProperty({ type: String })
  shell: string;

  @ApiProperty({
    enum: TaskTerminalSessionStatus,
    enumName: 'TaskTerminalSessionStatus',
  })
  status: TaskTerminalSessionStatus;

  @ApiProperty({ type: Date })
  createdAt: Date;

  @ApiProperty({ type: Date })
  updatedAt: Date;
}

export class TaskTerminalSessionListDto {
  @ApiProperty({ type: TaskTerminalSessionDto, isArray: true })
  sessions: TaskTerminalSessionDto[];
}

export class TaskTerminalEventDto {
  @ApiProperty({ type: String, enum: ['chunk', 'status', 'exit', 'error'] })
  type: 'chunk' | 'status' | 'exit' | 'error';

  @ApiPropertyOptional({ type: String, nullable: true })
  stream?: 'stdout' | 'stderr' | null;

  @ApiPropertyOptional({ type: String, nullable: true })
  data?: string | null;

  @ApiPropertyOptional({ type: Number, nullable: true })
  code?: number | null;

  @ApiPropertyOptional({ type: String, nullable: true })
  signal?: string | null;

  @ApiPropertyOptional({ type: String, nullable: true })
  message?: string | null;

  @ApiProperty({ type: Date })
  timestamp: Date;
}
