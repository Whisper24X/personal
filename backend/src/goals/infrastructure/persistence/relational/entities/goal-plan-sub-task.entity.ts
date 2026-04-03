import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { EntityRelationalHelper } from '../../../../../utils/relational-entity-helper';
import { GoalPlanItemStatus } from '../../../../dto/goal-plan-item-status.enum';

@Entity({ name: 'goal_plan_sub_tasks', comment: '任务计划子任务' })
export class GoalPlanSubTaskEntity extends EntityRelationalHelper {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index('IDX_goal_plan_sub_tasks_goal_plan_item_id')
  @Column({ type: 'uuid', comment: '所属功能组' })
  goalPlanItemId: string;

  @Column({ type: String, length: 240, comment: '标题' })
  title: string;

  @Column({ type: 'text', nullable: true, comment: '摘要' })
  summary?: string | null;

  @Column({ type: 'text', nullable: true, comment: '验收标准' })
  acceptanceCriteria?: string | null;

  @Column({ type: 'text', nullable: true, comment: '建议 prompt' })
  suggestedPrompt?: string | null;

  @Column({
    type: 'jsonb',
    default: () => "'[]'",
    comment: '依赖的其他子任务 ID',
  })
  dependsOnSubTaskIds: string[];

  @Column({ type: 'int', default: 0, comment: '顺序' })
  itemOrder: number;

  @Index('IDX_goal_plan_sub_tasks_task_id')
  @Column({ type: 'uuid', nullable: true, comment: '物化后的 Task' })
  taskId?: string | null;

  @Column({
    type: 'enum',
    enum: GoalPlanItemStatus,
    enumName: 'goal_plan_item_status_enum',
    default: GoalPlanItemStatus.draft,
    comment: '状态',
  })
  status: GoalPlanItemStatus;

  @Column({
    type: 'uuid',
    nullable: true,
    comment: '物化时使用的项目工作流模板 ID',
  })
  workflowTemplateId?: string | null;

  @CreateDateColumn({ comment: '创建时间' })
  createdAt: Date;

  @UpdateDateColumn({ comment: '更新时间' })
  updatedAt: Date;
}
