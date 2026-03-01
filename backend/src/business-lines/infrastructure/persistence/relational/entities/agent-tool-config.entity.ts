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
  name: 'agent_tool_configs',
})
@Index('IDX_agent_tool_config_business_line_id', ['businessLineId'])
@Index('IDX_agent_tool_config_tool_id', ['toolId'])
@Index(
  'UQ_agent_tool_config_business_line_tool_name',
  ['businessLineId', 'toolId', 'name'],
  {
    unique: true,
  },
)
export class AgentToolConfigEntity extends EntityRelationalHelper {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  businessLineId: string;

  @Column({ type: 'varchar', length: 64 })
  toolId: string;

  @Column({ type: 'varchar', length: 120 })
  name: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  description?: string | null;

  @Column({ type: 'text' })
  configJson: string;

  @Column({ type: 'boolean', default: false })
  isDefault: boolean;

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
