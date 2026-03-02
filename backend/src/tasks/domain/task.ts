import { ApiProperty } from '@nestjs/swagger';
import { TaskMode } from '../dto/task-mode.enum';
import { TaskStatus } from '../dto/task-status.enum';

export class Task {
  @ApiProperty({ type: String })
  id: string;

  @ApiProperty({ type: String })
  projectId: string;

  @ApiProperty({ type: String, nullable: true, required: false })
  workflowTemplateId?: string | null;

  @ApiProperty({ enum: TaskMode, enumName: 'TaskMode' })
  mode: TaskMode;

  @ApiProperty({ type: String })
  title: string;

  @ApiProperty({ type: String, required: false, nullable: true })
  description?: string | null;

  @ApiProperty({ type: Array, required: false, nullable: true })
  acceptanceCriteria?: unknown[] | null;

  @ApiProperty({ enum: TaskStatus, enumName: 'TaskStatus' })
  status: TaskStatus;

  @ApiProperty({ type: String, required: false, nullable: true })
  branch?: string | null;

  @ApiProperty({ type: String, required: false, nullable: true })
  gitBaseBranch?: string | null;

  @ApiProperty({ type: String, required: false, nullable: true })
  gitWorktreePath?: string | null;

  @ApiProperty({ type: Date, required: false, nullable: true })
  sandboxCleanupAt?: Date | null;

  @ApiProperty({ type: String, required: false, nullable: true })
  environment?: string | null;

  @ApiProperty({
    type: Object,
    required: false,
    nullable: true,
    description: 'Resolved tools versions used by this task',
  })
  toolVersionsSnapshot?: Record<string, unknown> | null;

  @ApiProperty({ type: String, required: false, nullable: true })
  createdBy?: string | null;

  @ApiProperty({ type: Date, required: false, nullable: true })
  startedAt?: Date | null;

  @ApiProperty({ type: Date, required: false, nullable: true })
  finishedAt?: Date | null;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;

  @ApiProperty()
  deletedAt: Date | null;
}
