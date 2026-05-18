import { Injectable } from '@nestjs/common';
import { ContainerExecutionConfigService } from '../containers/container-execution-config.service';
import { IsolatedRunnerContainerService } from '../containers/isolated-runner-container.service';
import { ProjectExecutionSlotRepository } from '../containers/infrastructure/persistence/relational/repositories/project-execution-slot.repository';
import type { AgentToolConfig } from '../business-lines/domain/agent-tool-config';
import { LocalMcpProbeResultDto } from '../business-lines/dto/local-mcp-probe-result.dto';
import { LocalMcpProbeService } from '../business-lines/local-mcp-probe.service';
import type { Project } from '../projects/domain/project';

@Injectable()
export class RunnerMcpProbeService {
  constructor(
    private readonly slotRepository: ProjectExecutionSlotRepository,
    private readonly isolatedRunner: IsolatedRunnerContainerService,
    private readonly containerConfig: ContainerExecutionConfigService,
    private readonly localMcpProbeService: LocalMcpProbeService,
  ) {}

  async probeWithResolvedLocal(params: {
    project: Pick<Project, 'id'>;
    agentToolConfig: Pick<AgentToolConfig, 'toolId' | 'configJson'>;
    local: {
      name: string;
      sourcePath: string;
      config: Record<string, unknown>;
    };
  }): Promise<LocalMcpProbeResultDto> {
    const slot = await this.slotRepository.findActiveWithContainerByProjectId(
      params.project.id,
    );

    if (!slot?.containerId) {
      return {
        ok: false,
        executionPlane: 'runner',
        errorCode: 'RUNNER_NOT_READY',
        message:
          '当前项目没有运行中的 Runner 容器，请先启动执行环境后再测试 MCP。',
      };
    }

    const inspection = await this.isolatedRunner.inspect(slot.containerId);
    if (!inspection?.running) {
      return {
        ok: false,
        executionPlane: 'runner',
        containerId: slot.containerId,
        errorCode: 'RUNNER_NOT_READY',
        message: '当前项目 Runner 容器未运行，请先启动执行环境后再测试 MCP。',
      };
    }

    const cwdInContainer = this.containerConfig.getRunnerWorkspace();
    return this.localMcpProbeService.probeWithResolvedLocal({
      agentToolConfig: params.agentToolConfig,
      local: params.local,
      runner: {
        containerRef: slot.containerId,
        cwdInContainer,
      },
    });
  }
}
