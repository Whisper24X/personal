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

@Entity({
  name: 'business_lines',
  comment: '业务线',
})
export class BusinessLineEntity extends EntityRelationalHelper {
  @PrimaryGeneratedColumn('uuid', { comment: '主键（UUID）' })
  id: string;

  @Index('IDX_business_lines_name')
  @Index('UQ_business_lines_name', {
    unique: true,
    where: '"deletedAt" IS NULL',
  })
  @Column({ type: String, length: 100, comment: '业务线名称' })
  name: string;

  @Column({ type: 'text', nullable: true, comment: '业务线描述' })
  description?: string | null;

  @Column({
    type: 'varchar',
    length: 64,
    nullable: true,
    comment: '默认 Agent CLI 工具 ID',
  })
  defaultAgentCliToolId?: string | null;

  @CreateDateColumn({ comment: '创建时间' })
  createdAt: Date;

  @UpdateDateColumn({ comment: '更新时间' })
  updatedAt: Date;

  @DeleteDateColumn({ comment: '软删除时间' })
  deletedAt: Date | null;
}
