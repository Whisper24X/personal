import { ApiProperty } from '@nestjs/swagger';
import { Task } from '../../tasks/domain/task';
import { TaskStatus } from '../../tasks/dto/task-status.enum';
import { Goal } from '../domain/goal';
import { GoalPlanItem } from '../domain/goal-plan-item';
import { GoalSourceDoc } from '../domain/goal-source-doc';
import { TaskDependencyEdge } from '../domain/task-dependency-edge';

export class GoalProgressDto {
  @ApiProperty({ description: '任务计划子任务总数（不含已取消）' })
  totalTasks: number;

  @ApiProperty({ description: '对应 Task 已完成的子任务数' })
  doneTasks: number;

  @ApiProperty()
  percent: number;

  @ApiProperty()
  statusCounts: Record<TaskStatus, number>;
}

export class GoalDetailDto {
  @ApiProperty({ type: Goal })
  goal: Goal;

  @ApiProperty({ type: GoalSourceDoc, isArray: true })
  sourceDocs: GoalSourceDoc[];

  @ApiProperty({ type: GoalPlanItem, isArray: true })
  planItems: GoalPlanItem[];

  @ApiProperty({ type: Task, isArray: true })
  tasks: Task[];

  @ApiProperty({ type: TaskDependencyEdge, isArray: true })
  taskDependencies: TaskDependencyEdge[];

  @ApiProperty({ type: GoalProgressDto })
  progress: GoalProgressDto;
}
