import { ApiProperty } from '@nestjs/swagger';
import { TaskNodeType } from '../dto/task-node-type.enum';
import { TaskStatus } from '../dto/task-status.enum';

export class TaskNode {
  @ApiProperty({ type: String })
  id: string;

  @ApiProperty({ type: String })
  taskId: string;

  @ApiProperty({ type: Number })
  nodeOrder: number;

  @ApiProperty({ type: String })
  name: string;

  @ApiProperty({ enum: TaskNodeType, enumName: 'TaskNodeType' })
  nodeType: TaskNodeType;

  @ApiProperty({ type: Object, required: false, nullable: true })
  input?: Record<string, unknown> | null;

  @ApiProperty({ type: Object, required: false, nullable: true })
  output?: Record<string, unknown> | null;

  @ApiProperty({ type: Boolean, default: false })
  requiresApproval: boolean;

  @ApiProperty({ enum: TaskStatus, enumName: 'TaskStatus' })
  status: TaskStatus;

  @ApiProperty({ type: Number, default: 0 })
  attempt: number;

  @ApiProperty({ type: String, required: false, nullable: true })
  errorCode?: string | null;

  @ApiProperty({ type: String, required: false, nullable: true })
  errorMessage?: string | null;

  @ApiProperty({ type: Date, required: false, nullable: true })
  startedAt?: Date | null;

  @ApiProperty({ type: Date, required: false, nullable: true })
  finishedAt?: Date | null;

  @ApiProperty({ type: String, required: false, nullable: true })
  workerId?: string | null;

  @ApiProperty({ type: Date, required: false, nullable: true })
  leaseUntil?: Date | null;

  @ApiProperty({ type: Date, required: false, nullable: true })
  heartbeatAt?: Date | null;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;
}
