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
import { BusinessLineMemberRole } from '../../../../dto/business-line-member-role.enum';

@Entity({
  name: 'business_line_members',
})
@Unique('UQ_business_line_member_business_line_user', [
  'businessLineId',
  'userId',
])
export class BusinessLineMemberEntity extends EntityRelationalHelper {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index('IDX_business_line_member_business_line_id')
  @Column({ type: 'uuid' })
  businessLineId: string;

  @Index('IDX_business_line_member_user_id')
  @Column({ type: 'uuid' })
  userId: string;

  @Column({
    type: 'enum',
    enum: BusinessLineMemberRole,
    enumName: 'business_line_member_role_enum',
  })
  role: BusinessLineMemberRole;

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
