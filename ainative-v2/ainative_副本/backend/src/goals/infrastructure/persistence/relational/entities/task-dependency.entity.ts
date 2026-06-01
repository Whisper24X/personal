import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { EntityRelationalHelper } from '../../../../../utils/relational-entity-helper';
import { TaskDependencyRelation } from '../../../../dto/task-dependency-relation.enum';

@Entity({ name: 'task_dependencies', comment: 'Task 依赖关系' })
export class TaskDependencyEntity extends EntityRelationalHelper {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index('IDX_task_dependencies_predecessor')
  @Column({ type: 'uuid', comment: '前置任务' })
  predecessorTaskId: string;

  @Index('IDX_task_dependencies_successor')
  @Column({ type: 'uuid', comment: '后置任务' })
  successorTaskId: string;

  @Column({
    type: 'enum',
    enum: TaskDependencyRelation,
    enumName: 'task_dependency_relation_enum',
    default: TaskDependencyRelation.blocks,
    comment: '关系类型',
  })
  relationType: TaskDependencyRelation;

  @CreateDateColumn({ comment: '创建时间' })
  createdAt: Date;
}
