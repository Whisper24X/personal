import { ApiProperty } from '@nestjs/swagger';
import { TaskLogLevel } from '../dto/task-log-level.enum';

export class TaskLog {
  @ApiProperty({ type: String })
  id: string;

  @ApiProperty({ type: String })
  taskId: string;

  @ApiProperty({ type: String, required: false, nullable: true })
  taskNodeId?: string | null;

  @ApiProperty({ enum: TaskLogLevel, enumName: 'TaskLogLevel' })
  level: TaskLogLevel;

  @ApiProperty({ type: String })
  message: string;

  @ApiProperty({ type: Object, required: false, nullable: true })
  payload?: Record<string, unknown> | null;

  @ApiProperty()
  createdAt: Date;
}
