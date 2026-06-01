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
import { RepositoryProvisioningStatus } from '../../../../domain/repository-provisioning-status.enum';

@Entity({
  name: 'projects',
  comment: '业务线下项目',
})
@Index('UQ_projects_business_line_name', ['businessLineId', 'name'], {
  unique: true,
  where: '"deletedAt" IS NULL',
})
export class ProjectEntity extends EntityRelationalHelper {
  @PrimaryGeneratedColumn('uuid', { comment: '主键（UUID）' })
  id: string;

  @Index('IDX_projects_business_line_id')
  @Column({ type: 'uuid', comment: '所属业务线ID' })
  businessLineId: string;

  @Index('IDX_projects_name')
  @Column({ type: String, length: 120, comment: '项目名称' })
  name: string;

  @Column({ type: 'text', nullable: true, comment: '项目描述' })
  description?: string | null;

  @Column({ type: 'text', comment: 'Git仓库地址' })
  gitUrl: string;

  @Column({
    type: String,
    length: 120,
    default: 'main',
    comment: '默认仓库分支',
  })
  defaultBranch: string;

  @Column({ type: 'jsonb', nullable: true, comment: '项目配置JSON' })
  configJson?: Record<string, unknown> | null;

  @Column({
    type: String,
    length: 24,
    default: RepositoryProvisioningStatus.Ready,
    comment: '仓库本地副本准备状态',
  })
  repositoryProvisioningStatus: RepositoryProvisioningStatus;

  @Column({
    type: 'text',
    nullable: true,
    comment: '仓库准备失败信息（若有）',
  })
  repositoryProvisioningError?: string | null;

  @Column({
    type: 'timestamptz',
    nullable: true,
    comment: '仓库最近一次准备成功时间',
  })
  repositoryProvisionedAt?: Date | null;

  @CreateDateColumn({ comment: '创建时间' })
  createdAt: Date;

  @UpdateDateColumn({ comment: '更新时间' })
  updatedAt: Date;

  @DeleteDateColumn({ comment: '软删除时间' })
  deletedAt: Date | null;
}
