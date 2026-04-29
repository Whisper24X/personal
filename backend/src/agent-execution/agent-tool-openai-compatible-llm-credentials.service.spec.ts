import {
  AgentToolOpenAiCompatibleLlmCredentialsService,
  normalizeCodexStyleOpenAiChatBaseUrl,
} from './agent-tool-openai-compatible-llm-credentials.service';
import type { AgentToolConfigRepository } from '../business-lines/infrastructure/persistence/agent-tool-config.repository';
import { AgentCliAdapterRegistry } from './agent-cli/agent-cli-adapter.registry';

describe('normalizeCodexStyleOpenAiChatBaseUrl', () => {
  it('should append /v1 when missing', () => {
    expect(normalizeCodexStyleOpenAiChatBaseUrl('https://gw.example.com')).toBe(
      'https://gw.example.com/v1',
    );
  });
  it('should keep when already /v1', () => {
    expect(
      normalizeCodexStyleOpenAiChatBaseUrl('https://gw.example.com/v1'),
    ).toBe('https://gw.example.com/v1');
  });
});

describe('AgentToolOpenAiCompatibleLlmCredentialsService', () => {
  const project = () => ({
    id: 'p1',
    businessLineId: 'bl1',
    name: 'test',
    gitUrl: '',
    defaultBranch: 'main',
    configJson: null as Record<string, unknown> | null,
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null as Date | null,
  });

  it('should read default codex-tool config for business line', async () => {
    const registry = new AgentCliAdapterRegistry();
    const repo: Pick<
      AgentToolConfigRepository,
      'findDefaultByBusinessLineIdAndToolId'
    > = {
      findDefaultByBusinessLineIdAndToolId: jest.fn().mockResolvedValue({
        id: 'c1',
        businessLineId: 'bl1',
        toolId: 'codex',
        name: 'default',
        description: null,
        configJson: JSON.stringify({
          api_key: 'sk-db',
          base_url: 'https://gateway.example.test',
          model: 'gpt-x',
        }),
        isDefault: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      }),
    };

    const svc = new AgentToolOpenAiCompatibleLlmCredentialsService(
      repo as AgentToolConfigRepository,
      registry,
    );

    const r =
      await svc.resolvePartialOpenAiCompatibleLlmFromPersistedDefaults(
        project(),
      );
    expect(r.llmApiKey).toBe('sk-db');
    expect(r.llmModel).toBe('gpt-x');
    expect(r.llmBaseUrl).toBe(
      normalizeCodexStyleOpenAiChatBaseUrl('https://gateway.example.test'),
    );
  });

  it('should return partial triple when persisted row has api key without base URL', async () => {
    const registry = new AgentCliAdapterRegistry();
    const repo: Pick<
      AgentToolConfigRepository,
      'findDefaultByBusinessLineIdAndToolId'
    > = {
      findDefaultByBusinessLineIdAndToolId: jest.fn().mockResolvedValueOnce({
        id: 'c1',
        businessLineId: 'bl1',
        toolId: 'codex',
        name: 'default',
        description: null,
        configJson: JSON.stringify({
          api_key: 'sk-only',
          model: '',
        }),
        isDefault: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      }),
    };

    const svc = new AgentToolOpenAiCompatibleLlmCredentialsService(
      repo as AgentToolConfigRepository,
      registry,
    );

    const r =
      await svc.resolvePartialOpenAiCompatibleLlmFromPersistedDefaults(
        project(),
      );
    expect(r.llmApiKey).toBe('sk-only');
    expect(r.llmBaseUrl).toBeUndefined();
    expect(repo.findDefaultByBusinessLineIdAndToolId).toHaveBeenCalled();
  });
});
