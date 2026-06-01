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
import { BusinessLineCustomRoleEntity } from './business-line-custom-role.entity';

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

  @Column({ type: 'uuid', comment: '关联业务线ID' })
  businessLineId: string;

  @Index('IDX_business_line_member_user_id')
  @Column({ type: 'uuid', comment: '关联用户ID' })
  userId: string;

  @Index('IDX_business_line_member_role_id')
  @Column({ type: 'uuid', comment: '业务线角色ID' })
  roleId: string;

  @ManyToOne(() => BusinessLineEntity, {
    createForeignKeyConstraints: false,
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'businessLineId' })
  businessLine: BusinessLineEntity;

  @ManyToOne(() => BusinessLineCustomRoleEntity, {
    createForeignKeyConstraints: false,
    onDelete: 'RESTRICT',
  })
  @JoinColumn({ name: 'roleId' })
  roleRef: BusinessLineCustomRoleEntity;

  @CreateDateColumn({ comment: '创建时间' })
  createdAt: Date;

  @UpdateDateColumn({ comment: '更新时间' })
  updatedAt: Date;
}
