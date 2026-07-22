import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { EntityRelationalHelper } from '../../../../../utils/relational-entity-helper';

@Entity({
  name: 'business_lines',
  comment: '业务线',
})
export class BusinessLineEntity extends EntityRelationalHelper {
  @PrimaryGeneratedColumn('uuid', { comment: '主键（UUID）' })
  id: string;

  @Index('UQ_business_lines_name', {
    unique: true,
  })
  @Column({ type: String, length: 100, comment: '业务线名称' })
  name: string;

  @Index('UQ_business_lines_slug', { unique: true })
  @Column({
    type: 'varchar',
    length: 80,
    comment: '业务线在 ainative-workspace 中的稳定标识',
  })
  slug: string;

  @Column({ type: 'text', nullable: true, comment: '业务线描述' })
  description?: string | null;

  @Column({
    type: 'varchar',
    length: 64,
    nullable: true,
    comment: '默认 Agent CLI 工具 ID',
  })
  defaultAgentCliToolId?: string | null;

  @Column({
    type: 'jsonb',
    nullable: true,
    comment: '业务线配置JSON（子仓/Runner缓存等）',
  })
  configJson?: Record<string, unknown> | null;

  @CreateDateColumn({ comment: '创建时间' })
  createdAt: Date;

  @UpdateDateColumn({ comment: '更新时间' })
  updatedAt: Date;
}
