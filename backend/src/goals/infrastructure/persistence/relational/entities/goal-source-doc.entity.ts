import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { EntityRelationalHelper } from '../../../../../utils/relational-entity-helper';
import { GoalSourceDocType } from '../../../../dto/goal-source-doc-type.enum';

@Entity({ name: 'goal_source_docs', comment: '需求输入资料' })
export class GoalSourceDocEntity extends EntityRelationalHelper {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index('IDX_goal_source_docs_goal_id')
  @Column({ type: 'uuid', comment: '所属需求' })
  goalId: string;

  @Column({ type: String, length: 500, comment: '项目 docs 相对路径' })
  projectDocPath: string;

  @Column({
    type: 'enum',
    enum: GoalSourceDocType,
    enumName: 'goal_source_doc_type_enum',
    comment: '资料类型',
  })
  docType: GoalSourceDocType;

  @Column({ type: 'int', default: 0, comment: '排序' })
  sortOrder: number;

  @CreateDateColumn({ comment: '创建时间' })
  createdAt: Date;
}
