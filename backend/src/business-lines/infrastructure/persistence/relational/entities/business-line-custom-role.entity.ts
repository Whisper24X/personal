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
import { BusinessLineEntity } from './business-line.entity';

@Entity({
  name: 'business_line_roles',
  comment: '业务线角色',
})
export class BusinessLineCustomRoleEntity extends EntityRelationalHelper {
  @PrimaryGeneratedColumn('uuid', { comment: '主键（UUID）' })
  id: string;

  @Index('IDX_business_line_role_business_line_id')
  @Column({ type: 'uuid', comment: '所属业务线ID' })
  businessLineId: string;

  @Column({
    type: 'varchar',
    length: 64,
    comment: '角色代码',
  })
  code: string;

  @Column({ type: 'varchar', length: 120, comment: '角色名称' })
  name: string;

  @Column({ type: 'varchar', length: 255, nullable: true, comment: '角色描述' })
  description?: string | null;

  @Column({
    type: 'jsonb',
    default: () => "'[]'::jsonb",
    comment: '能力码列表(JSON)',
  })
  capabilities: string[];

  @ManyToOne(() => BusinessLineEntity, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'businessLineId' })
  businessLine: BusinessLineEntity;

  @CreateDateColumn({ comment: '创建时间' })
  createdAt: Date;

  @UpdateDateColumn({ comment: '更新时间' })
  updatedAt: Date;
}
