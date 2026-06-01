import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  normalizeAgentCliToolId,
  normalizeSupportedAgentCliToolId,
} from './agent-cli-tool-id';
import { BusinessLine } from './domain/business-line';
import { AgentToolConfig } from './domain/agent-tool-config';
import { CreateAgentToolConfigDto } from './dto/create-agent-tool-config.dto';
import { UpdateAgentToolConfigDto } from './dto/update-agent-tool-config.dto';
import { BusinessLineRepository } from './infrastructure/persistence/business-line.repository';
import { AgentToolConfigRepository } from './infrastructure/persistence/agent-tool-config.repository';

@Injectable()
export class BusinessLineAgentToolConfigService {
  constructor(
    private readonly agentToolConfigRepository: AgentToolConfigRepository,
    private readonly businessLineRepository: BusinessLineRepository,
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

    if (nextToolId !== this.normalizeToolId(existedConfig.toolId)) {
      await this.clearBusinessLineDefaultToolIfUnavailable(
        businessLineId,
        existedConfig.toolId,
      );
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
    await this.clearBusinessLineDefaultToolIfUnavailable(
      businessLineId,
      existedConfig.toolId,
    );
  }

  async getAgentToolConfigForBusinessLine(
    businessLineId: string,
    configId: AgentToolConfig['id'],
  ): Promise<AgentToolConfig> {
    const existedConfig =
      await this.agentToolConfigRepository.findById(configId);
    if (!existedConfig || existedConfig.businessLineId !== businessLineId) {
      throw new NotFoundException('Agent tool config not found');
    }

    return existedConfig;
  }

  async updateDefaultAgentCliTool(
    businessLineId: BusinessLine['id'],
    defaultAgentCliToolId: string | null,
  ): Promise<BusinessLine> {
    if (defaultAgentCliToolId === null) {
      const updatedBusinessLine = await this.businessLineRepository.update(
        businessLineId,
        {
          defaultAgentCliToolId: null,
        },
      );

      if (!updatedBusinessLine) {
        throw new NotFoundException('Business line not found');
      }

      return updatedBusinessLine;
    }

    const normalizedToolId = normalizeSupportedAgentCliToolId(
      defaultAgentCliToolId,
    );

    if (!normalizedToolId) {
      throw new BadRequestException('Invalid default agent cli tool id');
    }

    const configs = await this.agentToolConfigRepository.findByBusinessLineId(
      businessLineId,
      normalizedToolId,
    );

    if (configs.length === 0) {
      throw new BadRequestException(
        'Default agent cli tool must reference an existing configured tool',
      );
    }

    const updatedBusinessLine = await this.businessLineRepository.update(
      businessLineId,
      {
        defaultAgentCliToolId: normalizedToolId,
      },
    );

    if (!updatedBusinessLine) {
      throw new NotFoundException('Business line not found');
    }

    return updatedBusinessLine;
  }

  private normalizeToolId(value: string): string {
    const normalized = value.trim().toLowerCase();

    if (!normalized) {
      throw new BadRequestException('Invalid tool id');
    }

    return normalizeAgentCliToolId(normalized);
  }

  private async clearBusinessLineDefaultToolIfUnavailable(
    businessLineId: BusinessLine['id'],
    toolId: string,
  ): Promise<void> {
    const normalizedToolId = normalizeAgentCliToolId(toolId);
    const businessLine =
      await this.businessLineRepository.findById(businessLineId);

    if (
      !businessLine ||
      businessLine.defaultAgentCliToolId !== normalizedToolId
    ) {
      return;
    }

    const remainingConfigs =
      await this.agentToolConfigRepository.findByBusinessLineId(
        businessLineId,
        normalizedToolId,
      );

    if (remainingConfigs.length > 0) {
      return;
    }

    await this.businessLineRepository.update(businessLineId, {
      defaultAgentCliToolId: null,
    });
  }
}
