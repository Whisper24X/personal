import { ApiProperty } from '@nestjs/swagger';
import { TaskNodeStatus } from '../dto/task-node-status.enum';
import {
  TaskLoopConfig,
  TaskNodeConfig,
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
    description:
      'Node configuration JSON (e.g. requiresApproval, requiresArtifact)',
  })
  configJson?: TaskNodeConfig | null;

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

  @ApiProperty({
    type: String,
    required: false,
    nullable: true,
    description: 'Git HEAD commit SHA captured before this node execution',
  })
  beforeRunCommitSha?: string | null;

  @ApiProperty({
    type: String,
    required: false,
    nullable: true,
    description: 'Git HEAD commit SHA after this node execution settled',
  })
  afterRunCommitSha?: string | null;

  @ApiProperty({ enum: TaskNodeStatus, enumName: 'TaskNodeStatus' })
  status: TaskNodeStatus;

  @ApiProperty({ type: Date, required: false, nullable: true })
  startedAt?: Date | null;

  @ApiProperty({ type: Date, required: false, nullable: true })
  finishedAt?: Date | null;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;
}
