import { Column, Entity, Index, PrimaryGeneratedColumn, Unique } from 'typeorm';
import { EntityRelationalHelper } from '../../../../../utils/relational-entity-helper';

@Entity({
  name: 'project_execution_slots',
  comment: '项目级任务容器执行槽（每任务最多一条活跃记录，项目可并发多条）',
})
@Unique('UQ_project_execution_slots_task', ['taskId'])
@Index('IDX_project_execution_slots_project', ['projectId'])
@Index('IDX_project_execution_slots_expires', ['expiresAt'])
export class ProjectExecutionSlotEntity extends EntityRelationalHelper {
  @PrimaryGeneratedColumn('uuid', { comment: '主键' })
  id: string;

  @Column({ type: 'uuid', comment: '项目ID' })
  projectId: string;

  @Column({ type: 'uuid', comment: '占用槽位的任务ID' })
  taskId: string;

  @Column({ type: 'text', nullable: true, comment: 'Docker 容器 ID' })
  containerId?: string | null;

  @Column({ type: 'jsonb', nullable: true, comment: '容器访问元数据' })
  accessMetadata?: Record<string, unknown> | null;

  @Column({ type: 'timestamp', comment: '占用时间' })
  claimedAt: Date;

  @Column({ type: 'timestamp', comment: '过期时间（需心跳续约）' })
  expiresAt: Date;

  @Column({ type: 'timestamp', nullable: true, comment: '上次心跳时间' })
  heartbeatAt?: Date | null;
}
