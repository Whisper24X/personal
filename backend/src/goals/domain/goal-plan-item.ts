import { ApiProperty } from '@nestjs/swagger';
import { GoalPlanItemStatus } from '../dto/goal-plan-item-status.enum';

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

  @ApiProperty({ required: false, nullable: true })
  taskId?: string | null;

  @ApiProperty({ enum: GoalPlanItemStatus, enumName: 'GoalPlanItemStatus' })
  status: GoalPlanItemStatus;

  @ApiProperty({
    required: false,
    nullable: true,
    description: '物化该计划项时使用的项目工作流模板 ID',
  })
  workflowTemplateId?: string | null;

  @ApiProperty({
    required: false,
    nullable: true,
    description: '物化任务时使用的 Git 基准分支（与新建任务 gitBaseBranch 一致）',
  })
  gitBaseBranch?: string | null;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;
}
