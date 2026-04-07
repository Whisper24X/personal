import { Module, forwardRef } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
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
import { PromptTemplateService } from './prompt-template.service';
import { AgentExecutionConfigResolverService } from './agent-execution-config-resolver.service';
import { ControlPlaneAgentExecutionService } from './control-plane-agent-execution.service';
import { LocalProcessLauncherService } from './local-process-launcher.service';
import { RunnerAgentExecutionService } from './runner-agent-execution.service';
import { TaskConfigResolverService } from './application/task-config-resolver.service';
import { TaskOutputService } from './application/task-output.service';
import { TaskLogService } from './application/task-log.service';
import { TaskStatusService } from './application/task-status.service';
import { AgentCliAdapterRegistry } from './agent-cli/agent-cli-adapter.registry';
import { TaskAccessService } from './application/task-access.service';
import { TaskRuntimeOrchestratorService } from './application/task-runtime-orchestrator.service';
import { TaskQueryService } from './application/task-query.service';
import { TaskCommandService } from './application/task-command.service';
import { TaskInteractionService } from './application/task-interaction.service';
import { TaskNodeExecutionService } from './application/task-node-execution.service';
import { TaskSchedulerService } from './application/task-scheduler.service';
import { TaskTitleSuggestionService } from './application/task-title-suggestion.service';
import { ContainersModule } from '../containers/containers.module';
import { TaskWorkspaceContextCacheService } from './application/task-workspace-context-cache.service';
import { TaskWorkspaceWatchService } from './application/task-workspace-watch.service';
import { GoalsModule } from '../goals/goals.module';
import { TaskEnvironmentService } from './application/task-environment.service';

@Module({
  imports: [
    RelationalTaskPersistenceModule,
    ContainersModule,
    forwardRef(() => GoalsModule),
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
    PromptTemplateService,
    AgentExecutionConfigResolverService,
    LocalProcessLauncherService,
    ControlPlaneAgentExecutionService,
    RunnerAgentExecutionService,
    TaskWorkspaceService,
    TaskGitService,
    TaskTerminalService,
    TaskConfigResolverService,
    TaskOutputService,
    TaskLogService,
    TaskStatusService,
    AgentCliAdapterRegistry,
    TaskAccessService,
    TaskRuntimeOrchestratorService,
    TaskQueryService,
    TaskCommandService,
    TaskInteractionService,
    TaskNodeExecutionService,
    TaskSchedulerService,
    TaskTitleSuggestionService,
    TaskWorkspaceContextCacheService,
    TaskWorkspaceWatchService,
    TaskEnvironmentService,
    TerminalGateway,
  ],
  exports: [
    TasksService,
    TaskRuntimeService,
    ControlPlaneAgentExecutionService,
    RunnerAgentExecutionService,
    RelationalTaskPersistenceModule,
  ],
})
export class TasksModule {}
