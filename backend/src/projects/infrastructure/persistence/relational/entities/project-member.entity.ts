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
import { ProjectEntity } from './project.entity';
import { ProjectMemberRole } from '../../../../dto/project-member-role.enum';

@Entity({
  name: 'project_members',
})
@Unique('UQ_project_member_project_user', ['projectId', 'userId'])
export class ProjectMemberEntity extends EntityRelationalHelper {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index('IDX_project_members_project_id')
  @Column({ type: 'uuid' })
  projectId: string;

  @Index('IDX_project_members_user_id')
  @Column({ type: 'uuid' })
  userId: string;

  @Column({
    type: 'enum',
    enum: ProjectMemberRole,
    enumName: 'project_member_role_enum',
  })
  role: ProjectMemberRole;

  @ManyToOne(() => ProjectEntity, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'projectId' })
  project: ProjectEntity;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
