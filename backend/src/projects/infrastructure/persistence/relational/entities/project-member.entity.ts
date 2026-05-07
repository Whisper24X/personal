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
import { ProjectCustomRoleEntity } from './project-custom-role.entity';

@Entity({
  name: 'project_members',
  comment: '项目成员',
})
@Unique('UQ_project_member_project_user', ['projectId', 'userId'])
export class ProjectMemberEntity extends EntityRelationalHelper {
  @PrimaryGeneratedColumn('uuid', { comment: '主键（UUID）' })
  id: string;

  @Column({ type: 'uuid', comment: '关联项目ID' })
  projectId: string;

  @Index('IDX_project_members_user_id')
  @Column({ type: 'uuid', comment: '关联用户ID' })
  userId: string;

  @Index('IDX_project_members_role_id')
  @Column({ type: 'uuid', comment: '项目角色ID' })
  roleId: string;

  @ManyToOne(() => ProjectEntity, {
    createForeignKeyConstraints: false,
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'projectId' })
  project: ProjectEntity;

  @ManyToOne(() => ProjectCustomRoleEntity, {
    createForeignKeyConstraints: false,
    onDelete: 'RESTRICT',
  })
  @JoinColumn({ name: 'roleId' })
  roleRef: ProjectCustomRoleEntity;

  @CreateDateColumn({ comment: '创建时间' })
  createdAt: Date;

  @UpdateDateColumn({ comment: '更新时间' })
  updatedAt: Date;
}
