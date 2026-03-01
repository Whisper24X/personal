import { Module } from '@nestjs/common';
import { TasksController } from './tasks.controller';
import { TasksService } from './tasks.service';
import { RelationalTaskPersistenceModule } from './infrastructure/persistence/relational/relational-persistence.module';
import { ProjectsModule } from '../projects/projects.module';
import { WorkflowTemplatesModule } from '../workflow-templates/workflow-templates.module';
import { TaskLogEventsService } from './task-log-events.service';
import { NotificationsModule } from '../notifications/notifications.module';
import { TaskRuntimeService } from './task-runtime.service';
import { AgentRunnerService } from './agent-runner.service';
import { SkillsModule } from '../skills/skills.module';
import { McpsModule } from '../mcps/mcps.module';
import { RelationalBusinessLinePersistenceModule } from '../business-lines/infrastructure/persistence/relational/relational-persistence.module';

@Module({
  imports: [
    RelationalTaskPersistenceModule,
    ProjectsModule,
    WorkflowTemplatesModule,
    NotificationsModule,
    SkillsModule,
    McpsModule,
    RelationalBusinessLinePersistenceModule,
  ],
  controllers: [TasksController],
  providers: [
    TasksService,
    TaskLogEventsService,
    TaskRuntimeService,
    AgentRunnerService,
  ],
  exports: [TasksService, RelationalTaskPersistenceModule],
})
export class TasksModule {}
