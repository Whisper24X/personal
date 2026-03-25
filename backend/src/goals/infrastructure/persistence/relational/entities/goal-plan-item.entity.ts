import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { EntityRelationalHelper } from '../../../../../utils/relational-entity-helper';
import { GoalPlanItemStatus } from '../../../../dto/goal-plan-item-status.enum';
import { GoalEntity } from './goal.entity';

@Entity({ name: 'goal_plan_items', comment: 'Goal 拆解计划项' })
export class GoalPlanItemEntity extends EntityRelationalHelper {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index('IDX_goal_plan_items_goal_id')
  @Column({ type: 'uuid', comment: '所属 Goal' })
  goalId: string;

  @ManyToOne(() => GoalEntity, { onDelete: 'CASCADE', createForeignKeyConstraints: false })
  @JoinColumn({ name: 'goalId' })
  goal?: GoalEntity;

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
    comment: '依赖的计划项 ID 列表',
  })
  dependsOnItemIds: string[];

  @Column({ type: 'int', default: 0, comment: '顺序' })
  itemOrder: number;

  @Index('IDX_goal_plan_items_task_id')
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
    comment: '物化该计划项时使用的项目工作流模板 ID',
  })
  workflowTemplateId?: string | null;

  @Column({
    type: String,
    length: 120,
    nullable: true,
    comment: '物化任务时使用的 Git 基准分支',
  })
  gitBaseBranch?: string | null;

  @CreateDateColumn({ comment: '创建时间' })
  createdAt: Date;

  @UpdateDateColumn({ comment: '更新时间' })
  updatedAt: Date;
}
