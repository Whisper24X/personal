import { ApiProperty } from '@nestjs/swagger';
import { TaskMode } from '../dto/task-mode.enum';
import { TaskStatus } from '../dto/task-status.enum';
import { TaskConfig } from '../types/task-config.type';

export class Task {
  @ApiProperty({ type: String })
  id: string;

  @ApiProperty({ type: String })
  projectId: string;

  @ApiProperty({ type: String, required: false, nullable: true })
  goalId?: string | null;

  @ApiProperty({ type: String })
  businessLineId: string;

  @ApiProperty({ enum: TaskMode, enumName: 'TaskMode' })
  mode: TaskMode;

  @ApiProperty({ type: String })
  title: string;

  @ApiProperty({ type: String, required: false, nullable: true })
  prompt?: string | null;

  @ApiProperty({ enum: TaskStatus, enumName: 'TaskStatus' })
  status: TaskStatus;

  @ApiProperty({ type: String, required: false, nullable: true })
  gitBranch?: string | null;

  @ApiProperty({ type: String, required: false, nullable: true })
  gitBaseBranch?: string | null;

  @ApiProperty({
    type: String,
    required: false,
    nullable: true,
    description:
      'Worktree identifier; runtime path is derived from project config',
  })
  gitWorktree?: string | null;

  @ApiProperty({
    type: Object,
    required: false,
    nullable: true,
    description: 'Task execution configuration',
  })
  configJson?: TaskConfig | null;

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
