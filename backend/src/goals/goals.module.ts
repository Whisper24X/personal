import { Module } from '@nestjs/common';
import { GoalsController } from './goals.controller';
import { GoalsService } from './goals.service';
import { GoalsMetricsService } from './goals-metrics.service';
import { GoalsFeatureGuard } from './goals-feature.guard';
import { GoalSourceDocsService } from './goal-source-docs.service';
import { RelationalGoalPersistenceModule } from './infrastructure/persistence/relational/relational-persistence.module';
import { ProjectsModule } from '../projects/projects.module';
import { RelationalTaskPersistenceModule } from '../tasks/infrastructure/persistence/relational/relational-persistence.module';
import { TasksModule } from '../tasks/tasks.module';
import { GitModule } from '../git/git.module';

@Module({
  imports: [
    RelationalGoalPersistenceModule,
    ProjectsModule,
    RelationalTaskPersistenceModule,
    TasksModule,
    GitModule,
  ],
  controllers: [GoalsController],
  providers: [
    GoalsService,
    GoalSourceDocsService,
    GoalsMetricsService,
    GoalsFeatureGuard,
  ],
  exports: [GoalsService, GoalsMetricsService, RelationalGoalPersistenceModule],
})
export class GoalsModule {}
