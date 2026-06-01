import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { EntityRelationalHelper } from '../../../../../utils/relational-entity-helper';
import { OAuthMcpCli } from '../../../../oauth-providers/oauth-mcp-provider.types';

export type ProjectMcpOAuthSessionStatus =
  | 'pending'
  | 'relayed'
  | 'succeeded'
  | 'failed'
  | 'timed_out';

@Entity({
  name: 'project_mcp_oauth_sessions',
  comment: '项目级 OAuth MCP 原生登录中转会话',
})
@Index('IDX_project_mcp_oauth_sessions_project_provider', [
  'projectId',
  'provider',
])
@Index('IDX_project_mcp_oauth_sessions_expires', ['expiresAt'])
export class ProjectMcpOAuthSessionEntity extends EntityRelationalHelper {
  @PrimaryGeneratedColumn('uuid', { comment: '主键 / sessionId' })
  id: string;

  @Column({ type: 'uuid', comment: '项目 ID' })
  projectId: string;

  @Column({ type: 'varchar', length: 64, comment: 'OAuth MCP provider' })
  provider: string;

  @Column({ type: 'varchar', length: 24, comment: 'Agent CLI' })
  cli: OAuthMcpCli;

  @Column({ type: 'text', nullable: true, comment: 'CLI 输出的 OAuth URL' })
  authorizationUrl?: string | null;

  @Column({
    type: 'varchar',
    length: 160,
    nullable: true,
    comment: 'OAuth state',
  })
  state?: string | null;

  @Column({ type: 'text', comment: 'Runner 容器引用' })
  containerExecRef: string;

  @Column({ type: 'integer', nullable: true, comment: 'CLI callback 端口' })
  cliLoginPort?: number | null;

  @Column({ type: 'varchar', length: 24, default: 'pending', comment: '状态' })
  status: ProjectMcpOAuthSessionStatus;

  @Column({ type: 'text', nullable: true, comment: '错误信息' })
  errorMessage?: string | null;

  @Column({ type: 'timestamptz', comment: '过期时间' })
  expiresAt: Date;

  @CreateDateColumn({ comment: '创建时间' })
  createdAt: Date;

  @UpdateDateColumn({ comment: '更新时间' })
  updatedAt: Date;
}
