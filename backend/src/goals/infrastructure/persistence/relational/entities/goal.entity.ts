import {
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { EntityRelationalHelper } from '../../../../../utils/relational-entity-helper';
import { GoalStatus } from '../../../../dto/goal-status.enum';

@Entity({ name: 'goals', comment: '需求' })
export class GoalEntity extends EntityRelationalHelper {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index('IDX_goals_project_id')
  @Column({ type: 'uuid', comment: '所属项目' })
  projectId: string;

  @Column({ type: String, length: 200, comment: '标题' })
  title: string;

  @Column({ type: 'text', nullable: true, comment: '摘要' })
  summary?: string | null;

  @Index('IDX_goals_status')
  @Column({
    type: 'enum',
    enum: GoalStatus,
    enumName: 'goal_status_enum',
    default: GoalStatus.draft,
    comment: '状态',
  })
  status: GoalStatus;

  @Column({
    type: String,
    length: 500,
    nullable: true,
    comment: 'PRD 文档相对路径',
  })
  prdDocPath?: string | null;

  @Column({
    type: String,
    length: 500,
    nullable: true,
    comment: '任务计划文档相对路径',
  })
  planDocPath?: string | null;

  @Column({ type: 'uuid', nullable: true, comment: '默认工作流模板' })
  defaultWorkflowTemplateId?: string | null;

  @Column({
    type: String,
    length: 64,
    nullable: true,
    comment: '生成 PRD/任务计划时默认使用的 Agent CLI 工具 ID',
  })
  agentCliId?: string | null;

  @Column({
    type: 'uuid',
    nullable: true,
    comment: '生成 PRD/任务计划时默认使用的业务线 Agent 工具配置 ID',
  })
  agentCliConfigId?: string | null;

  @Index('IDX_goals_created_by')
  @Column({ type: 'uuid', nullable: true, comment: '创建者' })
  createdBy?: string | null;

  @Column({
    type: String,
    length: 255,
    comment: '创建需求时用户选择的 Git 基准分支',
  })
  gitBaseBranch: string;

  @Column({
    type: String,
    length: 255,
    comment: '为本需求在仓库中创建的需求分支名',
  })
  gitBranch: string;

  @CreateDateColumn({ comment: '创建时间' })
  createdAt: Date;

  @UpdateDateColumn({ comment: '更新时间' })
  updatedAt: Date;

  @DeleteDateColumn({ comment: '软删除' })
  deletedAt?: Date | null;
}
