import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { GoalStatus } from '../../goals/dto/goal-status.enum';
import { Task } from '../domain/task';
import { TaskNode } from '../domain/task-node';

export class TaskGoalSummaryDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  title: string;

  @ApiProperty({ enum: GoalStatus, enumName: 'GoalStatus' })
  status: GoalStatus;
}

export class TaskDetailDto {
  @ApiProperty({ type: Task })
  task: Task;

  @ApiProperty({ type: TaskNode, isArray: true })
  nodes: TaskNode[];

  @ApiPropertyOptional({ type: TaskGoalSummaryDto, nullable: true })
  goalSummary?: TaskGoalSummaryDto | null;

  /** 为 true 时不应展示删除（仍有后置计划子任务依赖本任务且尚未物化） */
  @ApiPropertyOptional()
  planDeletionBlocked?: boolean;
}
