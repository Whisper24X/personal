import { forwardRef, Module } from '@nestjs/common';
import { RelationalBusinessLinePersistenceModule } from '../business-lines/infrastructure/persistence/relational/relational-persistence.module';
import { ContainersModule } from '../containers/containers.module';
import { ProjectWorkspaceModule } from '../project-workspace/project-workspace.module';
import { AgentCliAdapterRegistry } from './agent-cli/agent-cli-adapter.registry';
import { AgentCliSmokeTestService } from './agent-cli-smoke-test.service';
import { AgentExecutionConfigResolverService } from './agent-execution-config-resolver.service';
import { AgentPromptTemplateService } from './agent-prompt-template.service';
import { ControlPlaneAgentExecutionService } from './control-plane-agent-execution.service';
import { LocalProcessLauncherService } from './local-process-launcher.service';
import { RunnerAgentExecutionService } from './runner-agent-execution.service';
import { RunnerEphemeralMcpService } from './runner-ephemeral-mcp.service';
import { MemoryModule } from '../memory/memory.module';
import { AgentToolOpenAiCompatibleLlmCredentialsService } from './agent-tool-openai-compatible-llm-credentials.service';

@Module({
  imports: [
    RelationalBusinessLinePersistenceModule,
    ContainersModule,
    ProjectWorkspaceModule,
    forwardRef(() => MemoryModule),
  ],
  providers: [
    AgentPromptTemplateService,
    AgentExecutionConfigResolverService,
    LocalProcessLauncherService,
    ControlPlaneAgentExecutionService,
    RunnerAgentExecutionService,
    RunnerEphemeralMcpService,
    AgentCliAdapterRegistry,
    AgentCliSmokeTestService,
    AgentToolOpenAiCompatibleLlmCredentialsService,
  ],
  exports: [
    AgentPromptTemplateService,
    AgentExecutionConfigResolverService,
    ControlPlaneAgentExecutionService,
    RunnerAgentExecutionService,
    RunnerEphemeralMcpService,
    LocalProcessLauncherService,
    AgentCliAdapterRegistry,
    AgentCliSmokeTestService,
    AgentToolOpenAiCompatibleLlmCredentialsService,
  ],
})
export class AgentExecutionModule {}
