import { ApiProperty } from '@nestjs/swagger';
import { GoalPlanItemStatus } from '../dto/goal-plan-item-status.enum';

/** 计划子任务：唯一可物化为 Task 的单元 */
export class GoalPlanSubTask {
  @ApiProperty()
  id: string;

  @ApiProperty()
  goalPlanItemId: string;

  @ApiProperty()
  title: string;

  @ApiProperty({ required: false, nullable: true })
  summary?: string | null;

  @ApiProperty({ required: false, nullable: true })
  acceptanceCriteria?: string | null;

  @ApiProperty({ required: false, nullable: true })
  suggestedPrompt?: string | null;

  @ApiProperty({ type: [String] })
  dependsOnSubTaskIds: string[];

  @ApiProperty()
  itemOrder: number;

  @ApiProperty({ required: false, nullable: true })
  taskId?: string | null;

  @ApiProperty({ enum: GoalPlanItemStatus, enumName: 'GoalPlanItemStatus' })
  status: GoalPlanItemStatus;

  @ApiProperty({
    required: false,
    nullable: true,
    description: '物化该子任务时使用的项目工作流模板 ID',
  })
  workflowTemplateId?: string | null;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;
}
