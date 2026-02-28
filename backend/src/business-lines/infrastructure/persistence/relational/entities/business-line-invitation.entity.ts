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
import { BusinessLineMemberRole } from '../../../../dto/business-line-member-role.enum';
import { BusinessLineInviteProjectRole } from '../../../../dto/business-line-invite-project-role.enum';

@Entity({
  name: 'business_line_invitations',
})
export class BusinessLineInvitationEntity extends EntityRelationalHelper {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index('IDX_business_line_invitation_business_line_id')
  @Column({ type: 'uuid' })
  businessLineId: string;

  @Index('UQ_business_line_invitation_token', { unique: true })
  @Column({ type: 'varchar', length: 128 })
  token: string;

  @Column({
    type: 'enum',
    enum: BusinessLineMemberRole,
    enumName: 'business_line_member_role_enum',
  })
  role: BusinessLineMemberRole;

  @Column({
    type: 'jsonb',
    default: () => "'{}'::jsonb",
  })
  projectRoles: Record<string, BusinessLineInviteProjectRole>;

  @Column({ type: 'uuid' })
  createdBy: string;

  @Column({ type: 'timestamp' })
  expiresAt: Date;

  @Column({ type: 'timestamp', nullable: true })
  revokedAt: Date | null;

  @ManyToOne(() => BusinessLineEntity, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'businessLineId' })
  businessLine: BusinessLineEntity;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
