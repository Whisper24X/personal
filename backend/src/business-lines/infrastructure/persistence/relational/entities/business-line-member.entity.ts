import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
  UpdateDateColumn,
} from 'typeorm';
import { EntityRelationalHelper } from '../../../../../utils/relational-entity-helper';
import { BusinessLineEntity } from './business-line.entity';

@Entity({
  name: 'business_line_members',
  comment: '业务线成员',
})
@Unique('UQ_business_line_member_business_line_user', [
  'businessLineId',
  'userId',
])
export class BusinessLineMemberEntity extends EntityRelationalHelper {
  @PrimaryGeneratedColumn('uuid', { comment: '主键（UUID）' })
  id: string;

  @Index('IDX_business_line_member_business_line_id')
  @Column({ type: 'uuid', comment: '关联业务线ID' })
  businessLineId: string;

  @Index('IDX_business_line_member_user_id')
  @Column({ type: 'uuid', comment: '关联用户ID' })
  userId: string;

  @Index('IDX_business_line_member_role_code')
  @Column({
    name: 'businessLineRoleCode',
    type: 'varchar',
    length: 64,
    comment: '业务线角色代码',
  })
  role: string;

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
