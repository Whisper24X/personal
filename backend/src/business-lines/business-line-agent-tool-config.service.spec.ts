import { BadRequestException, NotFoundException } from '@nestjs/common';
import { BusinessLineAgentToolConfigService } from './business-line-agent-tool-config.service';
import { BusinessLine } from './domain/business-line';
import { AgentToolConfig } from './domain/agent-tool-config';
import { BusinessLineRepository } from './infrastructure/persistence/business-line.repository';
import { AgentToolConfigRepository } from './infrastructure/persistence/agent-tool-config.repository';

const createBusinessLine = (
  overrides: Partial<BusinessLine> = {},
): BusinessLine => ({
  id: 'line-1',
  name: 'Retail',
  description: 'Retail team',
  defaultAgentCliToolId: null,
  createdAt: new Date('2026-04-21T00:00:00.000Z'),
  updatedAt: new Date('2026-04-21T00:00:00.000Z'),
  ...overrides,
});

const createAgentToolConfig = (
  overrides: Partial<AgentToolConfig> = {},
): AgentToolConfig => ({
  id: 'cfg-1',
  businessLineId: 'line-1',
  toolId: 'codex',
  name: 'Codex Default',
  description: null,
  configJson: '{}',
  isDefault: false,
  createdAt: new Date('2026-04-21T00:00:00.000Z'),
  updatedAt: new Date('2026-04-21T00:00:00.000Z'),
  ...overrides,
});

const createAgentToolConfigRepositoryMock = () => ({
  create: jest.fn(),
  findByBusinessLineId: jest.fn(),
  findById: jest.fn(),
  findDefaultByBusinessLineIdAndToolId: jest.fn(),
  clearDefaultByBusinessLineIdAndToolId: jest.fn(),
  update: jest.fn(),
  remove: jest.fn(),
});

const createBusinessLineRepositoryMock = () => ({
  create: jest.fn(),
  findAllWithPagination: jest.fn(),
  findById: jest.fn(),
  findByIds: jest.fn(),
  findAllByIdsWithPagination: jest.fn(),
  findByName: jest.fn(),
  update: jest.fn(),
  remove: jest.fn(),
});

describe('BusinessLineAgentToolConfigService', () => {
  let service: BusinessLineAgentToolConfigService;
  let agentToolConfigRepository: ReturnType<
    typeof createAgentToolConfigRepositoryMock
  >;
  let businessLineRepository: ReturnType<
    typeof createBusinessLineRepositoryMock
  >;

  beforeEach(() => {
    agentToolConfigRepository = createAgentToolConfigRepositoryMock();
    businessLineRepository = createBusinessLineRepositoryMock();

    service = new BusinessLineAgentToolConfigService(
      agentToolConfigRepository as unknown as AgentToolConfigRepository,
      businessLineRepository as unknown as BusinessLineRepository,
    );
  });

  it('should normalize aliases when updating the default agent cli tool', async () => {
    const updatedBusinessLine = createBusinessLine({
      defaultAgentCliToolId: 'claude-code',
    });

    agentToolConfigRepository.findByBusinessLineId.mockResolvedValue([
      createAgentToolConfig({
        toolId: 'claude-code',
      }),
    ]);
    businessLineRepository.update.mockResolvedValue(updatedBusinessLine);

    const result = await service.updateDefaultAgentCliTool('line-1', 'claude');

    expect(agentToolConfigRepository.findByBusinessLineId).toHaveBeenCalledWith(
      'line-1',
      'claude-code',
    );
    expect(businessLineRepository.update).toHaveBeenCalledWith('line-1', {
      defaultAgentCliToolId: 'claude-code',
    });
    expect(result).toEqual(updatedBusinessLine);
  });

  it('should clear the default agent cli tool when null is provided', async () => {
    const updatedBusinessLine = createBusinessLine({
      defaultAgentCliToolId: null,
    });

    businessLineRepository.update.mockResolvedValue(updatedBusinessLine);

    const result = await service.updateDefaultAgentCliTool('line-1', null);

    expect(businessLineRepository.update).toHaveBeenCalledWith('line-1', {
      defaultAgentCliToolId: null,
    });
    expect(result).toEqual(updatedBusinessLine);
  });

  it('should reject default tools that have no configured agent cli entries', async () => {
    agentToolConfigRepository.findByBusinessLineId.mockResolvedValue([]);

    await expect(
      service.updateDefaultAgentCliTool('line-1', 'codex'),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(businessLineRepository.update).not.toHaveBeenCalled();
  });

  it('should clear the business line default tool after deleting the last matching config', async () => {
    agentToolConfigRepository.findById.mockResolvedValue(
      createAgentToolConfig({
        toolId: 'codex',
      }),
    );
    businessLineRepository.findById.mockResolvedValue(
      createBusinessLine({
        defaultAgentCliToolId: 'codex',
      }),
    );
    agentToolConfigRepository.findByBusinessLineId.mockResolvedValue([]);

    await service.removeAgentToolConfig('line-1', 'cfg-1');

    expect(agentToolConfigRepository.remove).toHaveBeenCalledWith('cfg-1');
    expect(businessLineRepository.update).toHaveBeenCalledWith('line-1', {
      defaultAgentCliToolId: null,
    });
  });

  it('should throw when removing an unknown config', async () => {
    agentToolConfigRepository.findById.mockResolvedValue(null);

    await expect(
      service.removeAgentToolConfig('line-1', 'cfg-missing'),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});
