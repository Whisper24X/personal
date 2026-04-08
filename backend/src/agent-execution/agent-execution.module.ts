import { Module } from '@nestjs/common';
import { RelationalBusinessLinePersistenceModule } from '../business-lines/infrastructure/persistence/relational/relational-persistence.module';
import { ContainersModule } from '../containers/containers.module';
import { ProjectWorkspaceModule } from '../project-workspace/project-workspace.module';
import { AgentCliAdapterRegistry } from './agent-cli/agent-cli-adapter.registry';
import { AgentExecutionConfigResolverService } from './agent-execution-config-resolver.service';
import { AgentPromptTemplateService } from './agent-prompt-template.service';
import { ControlPlaneAgentExecutionService } from './control-plane-agent-execution.service';
import { LocalProcessLauncherService } from './local-process-launcher.service';
import { RunnerAgentExecutionService } from './runner-agent-execution.service';

@Module({
  imports: [
    RelationalBusinessLinePersistenceModule,
    ContainersModule,
    ProjectWorkspaceModule,
  ],
  providers: [
    AgentPromptTemplateService,
    AgentExecutionConfigResolverService,
    LocalProcessLauncherService,
    ControlPlaneAgentExecutionService,
    RunnerAgentExecutionService,
    AgentCliAdapterRegistry,
  ],
  exports: [
    AgentPromptTemplateService,
    AgentExecutionConfigResolverService,
    ControlPlaneAgentExecutionService,
    RunnerAgentExecutionService,
    LocalProcessLauncherService,
    AgentCliAdapterRegistry,
  ],
})
export class AgentExecutionModule {}
