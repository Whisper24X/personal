import { ApiProperty } from '@nestjs/swagger';
import { GoalPlanSubTask } from './goal-plan-sub-task';

/** 计划功能组（父级）：不物化为 Task */
export class GoalPlanItem {
  @ApiProperty()
  id: string;

  @ApiProperty()
  goalId: string;

  @ApiProperty()
  title: string;

  @ApiProperty({ required: false, nullable: true })
  summary?: string | null;

  @ApiProperty({ required: false, nullable: true })
  acceptanceCriteria?: string | null;

  @ApiProperty({ required: false, nullable: true })
  suggestedPrompt?: string | null;

  @ApiProperty({ type: [String] })
  dependsOnItemIds: string[];

  @ApiProperty()
  itemOrder: number;

  @ApiProperty({
    required: false,
    nullable: true,
    description: '该功能组 Git 分支名；确认子任务前可为空',
  })
  gitBranch: string | null;

  @ApiProperty({
    required: false,
    nullable: true,
    description: '功能组分支已合并入需求分支的时间',
  })
  groupMergedIntoGoalAt: Date | null;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;

  /** 详情接口填充，非父表列 */
  @ApiProperty({ type: GoalPlanSubTask, isArray: true, required: false })
  subTasks?: GoalPlanSubTask[];
}
