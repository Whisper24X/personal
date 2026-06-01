import { MemoryLlmService } from './memory-llm.service';
import {
  loadMemoryRuntimeConfigFromEnv,
  type MemoryRuntimeConfigSnapshot,
} from './memory-runtime.config';

describe('MemoryLlmService', () => {
  const baseConfig = (): MemoryRuntimeConfigSnapshot => ({
    ...loadMemoryRuntimeConfigFromEnv(),
    llmProvider: 'openai-compatible',
    llmBaseUrl: 'https://api.openai.test/v1',
    llmApiKey: 'sk-test',
    llmModel: 'gpt-test',
    llmHeaders: [],
    llmCommand: '',
    llmMaxRetries: 0,
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('should call Anthropic messages API for anthropic provider', async () => {
    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          content: [{ type: 'text', text: '{"facts":[]}' }],
        }),
    });
    jest.spyOn(global, 'fetch').mockImplementation(fetchMock);

    const result = await new MemoryLlmService().completeJson<{
      facts: unknown[];
    }>({
      config: {
        ...baseConfig(),
        llmProvider: 'anthropic',
        llmBaseUrl: 'https://api.anthropic.test/v1',
        llmApiKey: 'sk-ant',
        llmModel: 'claude-test',
      },
      system: 'system',
      user: 'user',
    });

    expect(result).toEqual({ facts: [] });
    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.anthropic.test/v1/messages',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          'x-api-key': 'sk-ant',
          'anthropic-version': '2023-06-01',
        }),
      }),
    );
  });

  it('should call Cursor Agent CLI for cursor-agent provider', async () => {
    const service = new MemoryLlmService();
    const runCursorAgentCommand = jest
      .spyOn(
        service as unknown as {
          runCursorAgentCommand: (
            command: string,
            args: string[],
            env: Record<string, string>,
          ) => Promise<string>;
        },
        'runCursorAgentCommand',
      )
      .mockResolvedValue(JSON.stringify({ result: '{"facts":[]}' }));

    const result = await service.completeJson<{
      facts: unknown[];
    }>({
      config: {
        ...baseConfig(),
        llmProvider: 'cursor-agent',
        llmApiKey: 'cursor-key',
        llmModel: 'composer-test',
        llmHeaders: ['X-Test: 1'],
        llmCommand: 'agent',
      },
      system: 'system',
      user: 'user',
    });

    expect(result).toEqual({ facts: [] });
    expect(runCursorAgentCommand).toHaveBeenCalledWith(
      'agent',
      expect.arrayContaining([
        '--mode',
        'ask',
        '--model',
        'composer-test',
        '--header',
        'X-Test: 1',
      ]),
      expect.objectContaining({
        CURSOR_API_KEY: 'cursor-key',
      }),
    );
  });
});
