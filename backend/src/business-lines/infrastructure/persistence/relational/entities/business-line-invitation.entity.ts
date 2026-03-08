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
import { BusinessLineInviteProjectRole } from '../../../../dto/business-line-invite-project-role.enum';
import { BusinessLineCustomRoleEntity } from './business-line-custom-role.entity';

@Entity({
  name: 'business_line_invitations',
  comment: '业务线邀请',
})
export class BusinessLineInvitationEntity extends EntityRelationalHelper {
  @PrimaryGeneratedColumn('uuid', { comment: '主键（UUID）' })
  id: string;

  @Index('IDX_business_line_invitation_business_line_id')
  @Column({ type: 'uuid', comment: '关联业务线ID' })
  businessLineId: string;

  @Index('UQ_business_line_invitation_token', { unique: true })
  @Column({ type: 'varchar', length: 128, comment: '邀请令牌' })
  token: string;

  @Index('IDX_business_line_invitation_role_id')
  @Column({ type: 'uuid', comment: '业务线角色ID' })
  roleId: string;

  @Column({
    type: 'jsonb',
    default: () => "'{}'::jsonb",
    comment: '按项目分配的成员角色JSON',
  })
  projectRoles: Record<string, BusinessLineInviteProjectRole>;

  @Column({ type: 'uuid', comment: '邀请创建者用户ID' })
  createdBy: string;

  @Column({ type: 'timestamp', comment: '邀请过期时间' })
  expiresAt: Date;

  @Column({ type: 'timestamp', nullable: true, comment: '邀请撤销时间' })
  revokedAt: Date | null;

  @ManyToOne(() => BusinessLineEntity, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'businessLineId' })
  businessLine: BusinessLineEntity;

  @ManyToOne(() => BusinessLineCustomRoleEntity, {
    onDelete: 'RESTRICT',
  })
  @JoinColumn({ name: 'roleId' })
  roleRef: BusinessLineCustomRoleEntity;

  @CreateDateColumn({ comment: '创建时间' })
  createdAt: Date;

  @UpdateDateColumn({ comment: '更新时间' })
  updatedAt: Date;
}
