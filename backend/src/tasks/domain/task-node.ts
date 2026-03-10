import { ApiProperty } from '@nestjs/swagger';
import { TaskStatus } from '../dto/task-status.enum';
import {
  TaskLoopConfig,
  TaskNodeInput,
  TaskNodeRuntime,
} from '../types/task-config.type';

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
  agentClioutput?: string | null;

  @ApiProperty({
    type: String,
    required: false,
    nullable: true,
    description: 'CLI conversation/session identifier for follow-up messages',
  })
  agentCliSessionId?: string | null;

  @ApiProperty({
    type: String,
    required: false,
    nullable: true,
    description: 'CLI tool identifier resolved for this node',
  })
  agentCliId?: string | null;

  @ApiProperty({
    type: String,
    required: false,
    nullable: true,
    description: 'Agent tool config identifier resolved for this node',
  })
  agentCliConfigId?: string | null;

  @ApiProperty({
    type: Object,
    required: false,
    nullable: true,
    description: 'Loop execution config JSON',
  })
  loopJson?: TaskLoopConfig | null;

  @ApiProperty({
    type: Object,
    required: false,
    nullable: true,
    description: 'Ephemeral runtime state for in-progress execution',
  })
  runtimeJson?: TaskNodeRuntime | null;

  @ApiProperty({ enum: TaskStatus, enumName: 'TaskStatus' })
  status: TaskStatus;

  @ApiProperty({ type: Date, required: false, nullable: true })
  startedAt?: Date | null;

  @ApiProperty({ type: Date, required: false, nullable: true })
  finishedAt?: Date | null;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;
}
