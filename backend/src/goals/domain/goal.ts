import { ApiProperty } from '@nestjs/swagger';
import { GoalStatus } from '../dto/goal-status.enum';

export class Goal {
  @ApiProperty()
  id: string;

  @ApiProperty()
  projectId: string;

  @ApiProperty()
  title: string;

  @ApiProperty({ required: false, nullable: true })
  summary?: string | null;

  @ApiProperty({ enum: GoalStatus, enumName: 'GoalStatus' })
  status: GoalStatus;

  @ApiProperty({ required: false, nullable: true })
  prdDocPath?: string | null;

  @ApiProperty({ required: false, nullable: true })
  planDocPath?: string | null;

  @ApiProperty({ required: false, nullable: true })
  defaultWorkflowTemplateId?: string | null;

  @ApiProperty({
    required: false,
    nullable: true,
    description: '生成 PRD/任务计划时默认使用的 Agent CLI 工具 ID',
  })
  agentCliId?: string | null;

  @ApiProperty({
    required: false,
    nullable: true,
    description: '生成 PRD/任务计划时默认使用的业务线 Agent 工具配置 ID',
  })
  agentCliConfigId?: string | null;

  @ApiProperty({ required: false, nullable: true })
  createdBy?: string | null;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;

  @ApiProperty({ required: false, nullable: true })
  deletedAt?: Date | null;
}
