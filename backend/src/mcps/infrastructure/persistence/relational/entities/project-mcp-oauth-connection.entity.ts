import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { EntityRelationalHelper } from '../../../../../utils/relational-entity-helper';

export type ProjectMcpOAuthConnectionStatus =
  | 'connected'
  | 'disconnected'
  | 'pending'
  | 'error';

@Entity({
  name: 'project_mcp_oauth_connections',
  comment: '项目级 OAuth MCP 原生登录连接状态',
})
@Index('UQ_project_mcp_oauth_connection_provider', ['projectId', 'provider'], {
  unique: true,
})
@Index('IDX_project_mcp_oauth_connection_project', ['projectId'])
export class ProjectMcpOAuthConnectionEntity extends EntityRelationalHelper {
  @PrimaryGeneratedColumn('uuid', { comment: '主键' })
  id: string;

  @Column({ type: 'uuid', comment: '项目 ID' })
  projectId: string;

  @Column({ type: 'varchar', length: 64, comment: 'OAuth MCP provider' })
  provider: string;

  @Column({
    type: 'varchar',
    length: 24,
    default: 'disconnected',
    comment: '连接状态',
  })
  status: ProjectMcpOAuthConnectionStatus;

  @Column({ type: 'jsonb', nullable: true, comment: '各 CLI 登录状态' })
  cliRegistry?: Record<string, unknown> | null;

  @Column({
    type: 'varchar',
    length: 160,
    nullable: true,
    comment: '凭据卷引用',
  })
  credentialVolumeRef?: string | null;

  @Column({ type: 'uuid', nullable: true, comment: '最近授权用户 ID' })
  authorizedByUserId?: string | null;

  @Column({ type: 'text', nullable: true, comment: '最近错误' })
  lastError?: string | null;

  @CreateDateColumn({ comment: '创建时间' })
  createdAt: Date;

  @UpdateDateColumn({ comment: '更新时间' })
  updatedAt: Date;
}
