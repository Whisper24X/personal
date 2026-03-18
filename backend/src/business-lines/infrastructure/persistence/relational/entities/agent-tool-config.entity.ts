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

@Entity({
  name: 'agent_cli_configs',
  comment: '业务线工具配置',
})
@Index('IDX_agent_cli_config_business_line_id', ['businessLineId'])
@Index('IDX_agent_cli_config_tool_id', ['toolId'])
@Index(
  'UQ_agent_cli_config_business_line_tool_name',
  ['businessLineId', 'toolId', 'name'],
  {
    unique: true,
  },
)
@Index('UQ_agent_cli_config_default_per_tool', ['businessLineId', 'toolId'], {
  unique: true,
  where: '"isDefault" = true',
})
export class AgentToolConfigEntity extends EntityRelationalHelper {
  @PrimaryGeneratedColumn('uuid', { comment: '主键（UUID）' })
  id: string;

  @Column({ type: 'uuid', comment: '关联业务线ID' })
  businessLineId: string;

  @Column({ type: 'varchar', length: 64, comment: '工具标识' })
  toolId: string;

  @Column({ type: 'varchar', length: 120, comment: '配置名称' })
  name: string;

  @Column({ type: 'varchar', length: 255, nullable: true, comment: '配置描述' })
  description?: string | null;

  @Column({ type: 'text', comment: '工具配置JSON' })
  configJson: string;

  @Column({ type: 'boolean', default: false, comment: '是否默认配置' })
  isDefault: boolean;

  @ManyToOne(() => BusinessLineEntity, {
    createForeignKeyConstraints: false,
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'businessLineId' })
  businessLine: BusinessLineEntity;

  @CreateDateColumn({ comment: '创建时间' })
  createdAt: Date;

  @UpdateDateColumn({ comment: '更新时间' })
  updatedAt: Date;
}
