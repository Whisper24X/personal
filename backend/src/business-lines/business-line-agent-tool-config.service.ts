import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { AgentToolConfig } from './domain/agent-tool-config';
import { CreateAgentToolConfigDto } from './dto/create-agent-tool-config.dto';
import { UpdateAgentToolConfigDto } from './dto/update-agent-tool-config.dto';
import { AgentToolConfigRepository } from './infrastructure/persistence/agent-tool-config.repository';

@Injectable()
export class BusinessLineAgentToolConfigService {
  private static readonly TOOL_ID_ALIASES: Record<string, string> = {
    claude: 'claude-code',
    'claude-code': 'claude-code',
    codex: 'codex',
    'codex-cli': 'codex',
    cursor: 'cursor-agent',
    'cursor-agent': 'cursor-agent',
    gemini: 'gemini-cli',
    'gemini-cli': 'gemini-cli',
    opencode: 'opencode',
  };

  constructor(
    private readonly agentToolConfigRepository: AgentToolConfigRepository,
  ) {}

  async findAgentToolConfigs(
    businessLineId: string,
    toolId?: string,
  ): Promise<AgentToolConfig[]> {
    return this.agentToolConfigRepository.findByBusinessLineId(
      businessLineId,
      toolId ? this.normalizeToolId(toolId) : undefined,
    );
  }

  async createAgentToolConfig(
    businessLineId: string,
    createAgentToolConfigDto: CreateAgentToolConfigDto,
  ): Promise<AgentToolConfig> {
    const toolId = this.normalizeToolId(createAgentToolConfigDto.toolId);
    const existedConfigs =
      await this.agentToolConfigRepository.findByBusinessLineId(
        businessLineId,
        toolId,
      );

    if (
      existedConfigs.some(
        (item) => item.name.trim() === createAgentToolConfigDto.name.trim(),
      )
    ) {
      throw new ConflictException('Agent tool config name already exists');
    }

    if (createAgentToolConfigDto.isDefault === true) {
      await this.agentToolConfigRepository.clearDefaultByBusinessLineIdAndToolId(
        businessLineId,
        toolId,
      );
    }

    return this.agentToolConfigRepository.create({
      businessLineId,
      toolId,
      name: createAgentToolConfigDto.name.trim(),
      description: createAgentToolConfigDto.description?.trim() || null,
      configJson: JSON.stringify(createAgentToolConfigDto.configJson ?? {}),
      isDefault: createAgentToolConfigDto.isDefault === true,
    });
  }

  async updateAgentToolConfig(
    businessLineId: string,
    configId: AgentToolConfig['id'],
    updateAgentToolConfigDto: UpdateAgentToolConfigDto,
  ): Promise<AgentToolConfig> {
    const existedConfig =
      await this.agentToolConfigRepository.findById(configId);
    if (!existedConfig || existedConfig.businessLineId !== businessLineId) {
      throw new NotFoundException('Agent tool config not found');
    }

    const nextToolId =
      updateAgentToolConfigDto.toolId !== undefined
        ? this.normalizeToolId(updateAgentToolConfigDto.toolId)
        : existedConfig.toolId;
    const nextName =
      updateAgentToolConfigDto.name !== undefined
        ? updateAgentToolConfigDto.name.trim()
        : existedConfig.name;
    const nextIsDefault =
      updateAgentToolConfigDto.isDefault !== undefined
        ? updateAgentToolConfigDto.isDefault
        : existedConfig.isDefault;

    const sameToolConfigs =
      await this.agentToolConfigRepository.findByBusinessLineId(
        businessLineId,
        nextToolId,
      );
    const duplicate = sameToolConfigs.find(
      (item) => item.id !== configId && item.name.trim() === nextName,
    );
    if (duplicate) {
      throw new ConflictException('Agent tool config name already exists');
    }

    if (nextIsDefault) {
      await this.agentToolConfigRepository.clearDefaultByBusinessLineIdAndToolId(
        businessLineId,
        nextToolId,
        configId,
      );
    }

    const updatedConfig = await this.agentToolConfigRepository.update(
      configId,
      {
        ...(updateAgentToolConfigDto.toolId !== undefined
          ? {
              toolId: nextToolId,
            }
          : {}),
        ...(updateAgentToolConfigDto.name !== undefined
          ? {
              name: nextName,
            }
          : {}),
        ...(updateAgentToolConfigDto.description !== undefined
          ? {
              description: updateAgentToolConfigDto.description?.trim() || null,
            }
          : {}),
        ...(updateAgentToolConfigDto.configJson !== undefined
          ? {
              configJson: JSON.stringify(
                updateAgentToolConfigDto.configJson ?? {},
              ),
            }
          : {}),
        ...(updateAgentToolConfigDto.isDefault !== undefined
          ? {
              isDefault: updateAgentToolConfigDto.isDefault,
            }
          : {}),
      },
    );

    if (!updatedConfig) {
      throw new NotFoundException('Agent tool config not found');
    }

    return updatedConfig;
  }

  async removeAgentToolConfig(
    businessLineId: string,
    configId: AgentToolConfig['id'],
  ): Promise<void> {
    const existedConfig =
      await this.agentToolConfigRepository.findById(configId);
    if (!existedConfig || existedConfig.businessLineId !== businessLineId) {
      throw new NotFoundException('Agent tool config not found');
    }

    await this.agentToolConfigRepository.remove(configId);
  }

  private normalizeToolId(value: string): string {
    const normalized = value.trim().toLowerCase();

    if (!normalized) {
      throw new BadRequestException('Invalid tool id');
    }

    return BusinessLineAgentToolConfigService.TOOL_ID_ALIASES[normalized]
      ? BusinessLineAgentToolConfigService.TOOL_ID_ALIASES[normalized]
      : normalized;
  }
}
