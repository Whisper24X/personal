import { Optional } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AgentToolConfigRepository } from '../business-lines/infrastructure/persistence/agent-tool-config.repository';
import { ContainerExecutionConfigService } from '../containers/container-execution-config.service';
import { DockerExecProcessLauncherService } from '../containers/docker-exec-process-launcher.service';
import { IsolatedRunnerContainerService } from '../containers/isolated-runner-container.service';
import { AgentExecutionConfigResolverService } from './agent-execution-config-resolver.service';
import { AgentCliAdapterRegistry } from './agent-cli/agent-cli-adapter.registry';
import { AgentExecutionResult } from './agent-execution.types';
import { PromptTemplateService } from './prompt-template.service';
import { RunnerAgentExecutionService } from './runner-agent-execution.service';
import { TaskRuntimeService } from './task-runtime.service';

export type AgentRunnerResult = AgentExecutionResult;

/**
 * Compatibility shim for legacy tests and imports.
 * Production call sites should prefer RunnerAgentExecutionService directly.
 */
export class AgentRunnerService extends RunnerAgentExecutionService {
  constructor(
    agentToolConfigRepository: AgentToolConfigRepository,
    configService: ConfigService = new ConfigService(),
    promptTemplateService: PromptTemplateService = new PromptTemplateService(),
    agentCliAdapterRegistry: AgentCliAdapterRegistry = new AgentCliAdapterRegistry(),
    @Optional() taskRuntimeService?: TaskRuntimeService,
    @Optional()
    containerExecutionConfig?: ContainerExecutionConfigService,
    @Optional()
    dockerExecProcessLauncher?: DockerExecProcessLauncherService,
    @Optional()
    isolatedRunnerContainer?: IsolatedRunnerContainerService,
  ) {
    super(
      new AgentExecutionConfigResolverService(
        agentToolConfigRepository,
        configService,
        promptTemplateService,
        agentCliAdapterRegistry,
        taskRuntimeService,
      ),
      configService,
      agentCliAdapterRegistry,
      containerExecutionConfig,
      dockerExecProcessLauncher,
      isolatedRunnerContainer,
    );
  }
}
