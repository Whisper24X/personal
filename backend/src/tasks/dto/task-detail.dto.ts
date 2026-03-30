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
}
