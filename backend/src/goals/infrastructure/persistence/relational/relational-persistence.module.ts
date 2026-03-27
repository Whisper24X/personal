import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TaskEntity } from '../../../../tasks/infrastructure/persistence/relational/entities/task.entity';
import { GoalRepository } from '../goal.repository';
import { GoalRelationalRepository } from './repositories/goal.repository';
import { GoalEntity } from './entities/goal.entity';
import { GoalPlanItemEntity } from './entities/goal-plan-item.entity';
import { GoalPlanSubTaskEntity } from './entities/goal-plan-sub-task.entity';
import { GoalSourceDocEntity } from './entities/goal-source-doc.entity';
import { TaskDependencyEntity } from './entities/task-dependency.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      GoalEntity,
      GoalSourceDocEntity,
      GoalPlanItemEntity,
      GoalPlanSubTaskEntity,
      TaskDependencyEntity,
      TaskEntity,
    ]),
  ],
  providers: [
    {
      provide: GoalRepository,
      useClass: GoalRelationalRepository,
    },
  ],
  exports: [GoalRepository, TypeOrmModule],
})
export class RelationalGoalPersistenceModule {}
