import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { TaskLogLevel } from './task-log-level.enum';

export enum TaskMessageRole {
  user = 'user',
  assistant = 'assistant',
  system = 'system',
  error = 'error',
}

export class TaskMessageDto {
  @ApiProperty({ enum: TaskMessageRole, enumName: 'TaskMessageRole' })
  role: TaskMessageRole;

  @ApiProperty({ type: String })
  content: string;

  @ApiProperty({ type: Date })
  createdAt: Date;

  @ApiPropertyOptional({ type: String, nullable: true })
  taskNodeId?: string | null;

  @ApiPropertyOptional({ enum: TaskLogLevel, enumName: 'TaskLogLevel' })
  level?: TaskLogLevel;
}
