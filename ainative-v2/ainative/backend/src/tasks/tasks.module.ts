import { forwardRef, Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { AgentExecutionModule } from '../agent-execution/agent-execution.module';
import { ProjectWorkspaceModule } from '../project-workspace/project-workspace.module';
import { TasksController } from './tasks.controller';
import { TasksService } from './tasks.service';
import { RelationalTaskPersistenceModule } from './infrastructure/persistence/relational/relational-persistence.module';
import { ProjectsModule } from '../projects/projects.module';
import { WorkflowTemplatesModule } from '../workflow-templates/workflow-templates.module';
import { TaskLogEventsService } from './task-log-events.service';
import { NotificationsModule } from '../notifications/notifications.module';
import { TaskRuntimeService } from './task-runtime.service';
import { RelationalBusinessLinePersistenceModule } from '../business-lines/infrastructure/persistence/relational/relational-persistence.module';
import { TaskWorkspaceService } from './task-workspace.service';
import { TaskGitService } from './task-git.service';
import { TaskTerminalService } from './task-terminal.service';
import { TerminalGateway } from './terminal.gateway';
import { TaskConfigResolverService } from './application/task-config-resolver.service';
import { TaskOutputService } from './application/task-output.service';
import { TaskLogService } from './application/task-log.service';
import { TaskStatusService } from './application/task-status.service';
import { TaskAccessService } from './application/task-access.service';
import { TaskRuntimeOrchestratorService } from './application/task-runtime-orchestrator.service';
import { TaskQueryService } from './application/task-query.service';
import { TaskCommandService } from './application/task-command.service';
import { TaskInteractionService } from './application/task-interaction.service';
import { TaskNodeExecutionService } from './application/task-node-execution.service';
import { TaskWorkspaceArtifactService } from './application/task-workspace-artifact.service';
import { TaskSchedulerService } from './application/task-scheduler.service';
import { TaskTitleSuggestionService } from './application/task-title-suggestion.service';
import { ContainersModule } from '../containers/containers.module';
import { TaskWorkspaceContextCacheService } from './application/task-workspace-context-cache.service';
import { TaskWorkspaceWatchService } from './application/task-workspace-watch.service';
import { TaskEnvironmentService } from './application/task-environment.service';
import { RelationalGoalPersistenceModule } from '../goals/infrastructure/persistence/relational/relational-persistence.module';
import { TaskGoalService } from './application/task-goal.service';
import { TaskProvisioningService } from './application/task-provisioning.service';
import { WorkspaceNativeTaskService } from './application/workspace-native-task.service';
import { WorkspaceNativeDeployService } from './application/workspace-native-deploy.service';
import { MemoryModule } from '../memory/memory.module';
import { TaskPreviewDiagnosticService } from './application/task-preview-diagnostic.service';

@Module({
  imports: [
    forwardRef(() => MemoryModule),
    forwardRef(() => AgentExecutionModule),
    ProjectWorkspaceModule,
    RelationalTaskPersistenceModule,
    RelationalGoalPersistenceModule,
    ContainersModule,
    forwardRef(() => ProjectsModule),
    WorkflowTemplatesModule,
    NotificationsModule,
    RelationalBusinessLinePersistenceModule,
    JwtModule.register({}),
  ],
  controllers: [TasksController],
  providers: [
    TasksService,
    TaskLogEventsService,
    TaskRuntimeService,
    TaskWorkspaceService,
    TaskGitService,
    TaskTerminalService,
    TaskConfigResolverService,
    TaskOutputService,
    TaskLogService,
    TaskStatusService,
    TaskAccessService,
    TaskRuntimeOrchestratorService,
    TaskQueryService,
    TaskCommandService,
    TaskInteractionService,
    TaskNodeExecutionService,
    TaskWorkspaceArtifactService,
    TaskSchedulerService,
    TaskTitleSuggestionService,
    TaskWorkspaceContextCacheService,
    TaskWorkspaceWatchService,
    TaskEnvironmentService,
    TaskGoalService,
    TaskProvisioningService,
    TaskPreviewDiagnosticService,
    WorkspaceNativeTaskService,
    WorkspaceNativeDeployService,
    TerminalGateway,
  ],
  exports: [
    TasksService,
    TaskRuntimeService,
    TaskProvisioningService,
    TaskOutputService,
    RelationalTaskPersistenceModule,
  ],
})
export class TasksModule {}
