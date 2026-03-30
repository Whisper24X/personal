import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { EntityRelationalHelper } from '../../../../../utils/relational-entity-helper';

@Entity({ name: 'goal_plan_items', comment: '任务计划功能组（父级，不物化）' })
export class GoalPlanItemEntity extends EntityRelationalHelper {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index('IDX_goal_plan_items_goal_id')
  @Column({ type: 'uuid', comment: '所属需求' })
  goalId: string;

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
    comment: '依赖的其他功能组 ID',
  })
  dependsOnItemIds: string[];

  @Column({ type: 'int', default: 0, comment: '顺序' })
  itemOrder: number;

  @Column({
    type: String,
    length: 255,
    nullable: true,
    comment: '该功能组对应的 Git 分支名（首次确认子任务时创建后写入）',
  })
  gitBranch: string | null;

  @CreateDateColumn({ comment: '创建时间' })
  createdAt: Date;

  @UpdateDateColumn({ comment: '更新时间' })
  updatedAt: Date;
}
