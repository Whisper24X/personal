import { Module, forwardRef } from '@nestjs/common';
import { GoalsController } from './goals.controller';
import { GoalsService } from './goals.service';
import { GoalsMetricsService } from './goals-metrics.service';
import { GoalsFeatureGuard } from './goals-feature.guard';
import { RelationalGoalPersistenceModule } from './infrastructure/persistence/relational/relational-persistence.module';
import { ProjectsModule } from '../projects/projects.module';
import { RelationalTaskPersistenceModule } from '../tasks/infrastructure/persistence/relational/relational-persistence.module';
import { TasksModule } from '../tasks/tasks.module';
import { GitModule } from '../git/git.module';

@Module({
  imports: [
    RelationalGoalPersistenceModule,
    forwardRef(() => ProjectsModule),
    RelationalTaskPersistenceModule,
    forwardRef(() => TasksModule),
    GitModule,
  ],
  controllers: [GoalsController],
  providers: [GoalsService, GoalsMetricsService, GoalsFeatureGuard],
  exports: [GoalsService, GoalsMetricsService, RelationalGoalPersistenceModule],
})
export class GoalsModule {}
