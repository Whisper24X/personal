import { ApiProperty } from '@nestjs/swagger';
import { TaskStatus } from '../dto/task-status.enum';
import { TaskNodeInput, TaskNodeRuntime } from '../types/task-config.type';

export class TaskNode {
  @ApiProperty({ type: String })
  id: string;

  @ApiProperty({ type: String })
  taskId: string;

  @ApiProperty({ type: Number })
  nodeOrder: number;

  @ApiProperty({ type: String })
  name: string;

  @ApiProperty({ type: Object, required: false, nullable: true })
  input?: TaskNodeInput | null;

  @ApiProperty({ type: String, required: false, nullable: true })
  outputRef?: string | null;

  @ApiProperty({
    type: String,
    required: false,
    nullable: true,
    description: 'CLI tool identifier resolved for this node',
  })
  cliToolId?: string | null;

  @ApiProperty({
    type: String,
    required: false,
    nullable: true,
    description: 'Agent tool config identifier resolved for this node',
  })
  agentToolConfigId?: string | null;

  @ApiProperty({
    type: Object,
    required: false,
    nullable: true,
    description: 'Ephemeral runtime state for in-progress execution',
  })
  runtimeJson?: TaskNodeRuntime | null;

  @ApiProperty({ enum: TaskStatus, enumName: 'TaskStatus' })
  status: TaskStatus;

  @ApiProperty({ type: Number, default: 0 })
  attempt: number;

  @ApiProperty({ type: Date, required: false, nullable: true })
  startedAt?: Date | null;

  @ApiProperty({ type: Date, required: false, nullable: true })
  finishedAt?: Date | null;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;
}
