import { AiRunnerConfigGenerator } from './ai-runner-config-generator';

describe('AiRunnerConfigGenerator resolveToolConfig priority', () => {
  const createService = (options?: {
    businessLine?: Record<string, unknown> | null;
    configsByTool?: Record<string, Array<Record<string, unknown>>>;
    explicitConfigs?: Array<Record<string, unknown>>;
    invokeImpl?: (...args: any[]) => Promise<string>;
  }) => {
    const businessLineRepository = {
      findById: jest.fn().mockResolvedValue({
        id: 'bl-1',
        configJson: options?.businessLine?.configJson ?? {},
        defaultAgentCliToolId:
          options?.businessLine?.defaultAgentCliToolId ?? null,
      }),
    };

    const defaultLookups = options?.configsByTool ?? {};
    const explicitConfigs = options?.explicitConfigs ?? [];
    const agentToolConfigRepository = {
      findByBusinessLineId: jest.fn().mockResolvedValue(explicitConfigs),
      findDefaultByBusinessLineIdAndToolId: jest
        .fn()
        .mockImplementation((_businessLineId: string, toolId: string) => {
          const configs = defaultLookups[toolId] ?? [];
          return Promise.resolve(
            configs.find((item) => item.isDefault === true) ?? null,
          );
        }),
    };

    const service = new AiRunnerConfigGenerator(
      {} as never,
      agentToolConfigRepository as never,
      businessLineRepository as never,
    );

    const invokeCliWithPrompt = jest
      .spyOn(service as any, 'invokeCliWithPrompt')
      .mockImplementation(options?.invokeImpl ?? (() => Promise.resolve('{}')));

    return {
      service,
      businessLineRepository,
      agentToolConfigRepository,
      invokeCliWithPrompt,
    };
  };

  const buildConfig = (overrides: Record<string, unknown>) => ({
    id: 'cfg-1',
    toolId: 'codex',
    configJson: '{}',
    isDefault: true,
    ...overrides,
  });

  const createWorkspaceScanRequest = () => ({
    workspacePath: '/tmp/runner-workspace-123',
    repoPrefixes: ['yanxue', 'trip-shadow', 'trip-miniprogram'],
  });

  it('should prefer explicit runner generation config over business line default tool', async () => {
    const explicit = buildConfig({
      id: 'cfg-explicit',
      toolId: 'codex',
      configJson: '{"model":"gpt-5.4"}',
    });
    const cursorDefault = buildConfig({
      id: 'cfg-cursor',
      toolId: 'cursor-agent',
      configJson: '{"model":"composer 2 fast"}',
    });
    const { service } = createService({
      businessLine: {
        defaultAgentCliToolId: 'cursor-agent',
        configJson: {
          runnerGenerationAgentCliConfigId: 'cfg-explicit',
        },
      },
      explicitConfigs: [explicit, cursorDefault],
      configsByTool: {
        'cursor-agent': [cursorDefault],
      },
    });

    const result = await service.generateFromFullScan(
      'bl-1',
      createWorkspaceScanRequest(),
    );

    expect(result.generatorToolId).toBe('codex');
    expect(result.generatorConfigId).toBe('cfg-explicit');
    expect(result.warnings).toEqual(
      expect.arrayContaining([
        'runner_generation_tool_source=explicit_runner_config toolId=codex configId=cfg-explicit',
      ]),
    );
  });

  it('should use business line default tool when no explicit runner config is set', async () => {
    const cursorDefault = buildConfig({
      id: 'cfg-cursor',
      toolId: 'cursor-agent',
      configJson: '{"model":"composer 2 fast"}',
    });
    const { service } = createService({
      businessLine: {
        defaultAgentCliToolId: 'cursor-agent',
      },
      configsByTool: {
        'cursor-agent': [cursorDefault],
      },
    });

    const result = await service.generateFromFullScan(
      'bl-1',
      createWorkspaceScanRequest(),
    );

    expect(result.generatorToolId).toBe('cursor-agent');
    expect(result.generatorConfigId).toBe('cfg-cursor');
    expect(result.warnings).toEqual(
      expect.arrayContaining([
        'runner_generation_tool_source=business_line_default_tool toolId=cursor-agent configId=cfg-cursor',
      ]),
    );
  });

  it('should use codex when business line default tool is codex', async () => {
    const codexDefault = buildConfig({
      id: 'cfg-codex',
      toolId: 'codex',
      configJson: '{"model":"gpt-5.4"}',
    });
    const { service } = createService({
      businessLine: {
        defaultAgentCliToolId: 'codex',
      },
      configsByTool: {
        codex: [codexDefault],
      },
    });

    const result = await service.generateFromFullScan(
      'bl-1',
      createWorkspaceScanRequest(),
    );

    expect(result.generatorToolId).toBe('codex');
    expect(result.generatorConfigId).toBe('cfg-codex');
    expect(result.warnings).toEqual(
      expect.arrayContaining([
        'runner_generation_tool_source=business_line_default_tool toolId=codex configId=cfg-codex',
      ]),
    );
  });

  it('should fall back to codex when default tool has no usable default config', async () => {
    const codexDefault = buildConfig({
      id: 'cfg-codex',
      toolId: 'codex',
      configJson: '{"model":"gpt-5.4"}',
    });
    const { service } = createService({
      businessLine: {
        defaultAgentCliToolId: 'cursor-agent',
      },
      configsByTool: {
        codex: [codexDefault],
      },
    });

    const result = await service.generateFromFullScan(
      'bl-1',
      createWorkspaceScanRequest(),
    );

    expect(result.generatorToolId).toBe('codex');
    expect(result.generatorConfigId).toBe('cfg-codex');
    expect(result.warnings).toEqual(
      expect.arrayContaining([
        'runner_generation_default_tool_missing_default_config toolId=cursor-agent; falling back to built-in runner generation defaults',
        'runner_generation_tool_source=fallback_codex toolId=codex configId=cfg-codex',
      ]),
    );
  });

  it('should keep codex then opencode fallback when no business line default tool is set', async () => {
    const opencodeDefault = buildConfig({
      id: 'cfg-opencode',
      toolId: 'opencode',
      configJson: '{"model":"gpt-5"}',
    });
    const { service } = createService({
      businessLine: {
        defaultAgentCliToolId: null,
      },
      configsByTool: {
        opencode: [opencodeDefault],
      },
    });

    const result = await service.generateFromFullScan(
      'bl-1',
      createWorkspaceScanRequest(),
    );

    expect(result.generatorToolId).toBe('opencode');
    expect(result.generatorConfigId).toBe('cfg-opencode');
    expect(result.warnings).toEqual(
      expect.arrayContaining([
        'runner_generation_tool_source=fallback_opencode toolId=opencode configId=cfg-opencode',
      ]),
    );
  });

  it('should use small workspace-scan prompt and pass cloned workspace cwd', async () => {
    const cursorDefault = buildConfig({
      id: 'cfg-cursor',
      toolId: 'cursor-agent',
      configJson: '{"model":"composer 2 fast"}',
    });
    const { service, invokeCliWithPrompt } = createService({
      businessLine: {
        defaultAgentCliToolId: 'cursor-agent',
      },
      configsByTool: {
        'cursor-agent': [cursorDefault],
      },
    });

    await service.generateFromFullScan('bl-1', createWorkspaceScanRequest());

    expect(invokeCliWithPrompt).toHaveBeenCalledWith(
      'cursor-agent',
      expect.any(Object),
      expect.stringContaining('Repositories to scan:'),
      300000,
      '/tmp/runner-workspace-123',
    );
    const prompt = invokeCliWithPrompt.mock.calls[0]?.[2] as string;
    expect(prompt).toContain('- yanxue/');
    expect(prompt).toContain('Inspect the workspace directly.');
    expect(prompt).toContain('Makefile');
    expect(prompt).toContain(
      'Include backend/API services that sibling frontends depend on',
    );
    expect(prompt).toContain('"env"?: Record<string, string>');
    expect(prompt).toContain('"action": "proxy" | "redirect"');
    expect(prompt).toContain(
      'redirect routes when a frontend needs a trailing-slash redirect',
    );
    expect(prompt).not.toContain('"files":');
    expect(prompt).not.toContain('"content":');
    expect(prompt).not.toContain('Bounded evidence pack:');
    expect(prompt).not.toContain('Only use evidence from the provided files');
  });

  it('should keep normal AI generation timeout at 30 seconds', async () => {
    const codexDefault = buildConfig({
      id: 'cfg-codex',
      toolId: 'codex',
      configJson: '{"model":"gpt-5.4"}',
    });
    const { service, invokeCliWithPrompt } = createService({
      businessLine: {
        defaultAgentCliToolId: 'codex',
      },
      configsByTool: {
        codex: [codexDefault],
      },
    });

    await service.generate('bl-1', []);

    expect(invokeCliWithPrompt).toHaveBeenCalledWith(
      'codex',
      expect.any(Object),
      expect.any(String),
      30000,
      expect.any(String),
    );
  });

  it('should fall back to codex immediately when cursor runtime fails with quota-style error', async () => {
    const cursorDefault = buildConfig({
      id: 'cfg-cursor',
      toolId: 'cursor-agent',
      configJson: '{"model":"composer 2 fast"}',
    });
    const codexDefault = buildConfig({
      id: 'cfg-codex',
      toolId: 'codex',
      configJson: '{"model":"gpt-5.4"}',
    });
    const { service, invokeCliWithPrompt } = createService({
      businessLine: {
        defaultAgentCliToolId: 'cursor-agent',
      },
      configsByTool: {
        'cursor-agent': [cursorDefault],
        codex: [codexDefault],
      },
      invokeImpl: (toolId: string) => {
        if (toolId === 'cursor-agent') {
          return Promise.reject(
            new Error(
              "AI CLI exited with code 1: Increase limits for faster responses. You're out of usage.",
            ),
          );
        }
        return Promise.resolve('{}');
      },
    });

    const result = await service.generateFromFullScan(
      'bl-1',
      createWorkspaceScanRequest(),
    );

    expect(invokeCliWithPrompt).toHaveBeenNthCalledWith(
      1,
      'cursor-agent',
      expect.any(Object),
      expect.any(String),
      300000,
      '/tmp/runner-workspace-123',
    );
    expect(invokeCliWithPrompt).toHaveBeenNthCalledWith(
      2,
      'codex',
      expect.any(Object),
      expect.any(String),
      300000,
      '/tmp/runner-workspace-123',
    );
    expect(result.generatorToolId).toBe('codex');
    expect(result.warnings).toEqual(
      expect.arrayContaining([
        expect.stringContaining(
          'runner_generation_runtime_fallback fromToolId=cursor-agent toToolId=codex',
        ),
        'runner_generation_tool_source=fallback_after_runtime_error toolId=codex configId=cfg-codex',
      ]),
    );
  });

  it('should keep trying runtime fallback candidates after ENOENT failures', async () => {
    const cursorDefault = buildConfig({
      id: 'cfg-cursor',
      toolId: 'cursor-agent',
      configJson: '{"model":"composer 2 fast"}',
    });
    const codexDefault = buildConfig({
      id: 'cfg-codex',
      toolId: 'codex',
      configJson: '{"model":"gpt-5.4"}',
    });
    const opencodeDefault = buildConfig({
      id: 'cfg-opencode',
      toolId: 'opencode',
      configJson: '{"model":"gpt-5"}',
    });
    const { service, invokeCliWithPrompt } = createService({
      businessLine: {
        defaultAgentCliToolId: 'cursor-agent',
      },
      configsByTool: {
        'cursor-agent': [cursorDefault],
        codex: [codexDefault],
        opencode: [opencodeDefault],
      },
      invokeImpl: (toolId: string) => {
        if (toolId === 'cursor-agent') {
          return Promise.reject(new Error('spawn agent ENOENT'));
        }
        if (toolId === 'codex') {
          return Promise.reject(
            new Error('AI CLI exited with code 127: command not found'),
          );
        }
        return Promise.resolve('{}');
      },
    });

    const result = await service.generateFromFullScan(
      'bl-1',
      createWorkspaceScanRequest(),
    );

    expect(invokeCliWithPrompt).toHaveBeenNthCalledWith(
      1,
      'cursor-agent',
      expect.any(Object),
      expect.any(String),
      300000,
      '/tmp/runner-workspace-123',
    );
    expect(invokeCliWithPrompt).toHaveBeenNthCalledWith(
      2,
      'codex',
      expect.any(Object),
      expect.any(String),
      300000,
      '/tmp/runner-workspace-123',
    );
    expect(invokeCliWithPrompt).toHaveBeenNthCalledWith(
      3,
      'opencode',
      expect.any(Object),
      expect.any(String),
      300000,
      '/tmp/runner-workspace-123',
    );
    expect(result.generatorToolId).toBe('opencode');
    expect(result.warnings).toEqual(
      expect.arrayContaining([
        expect.stringContaining(
          'runner_generation_runtime_fallback fromToolId=cursor-agent toToolId=codex',
        ),
        expect.stringContaining(
          'runner_generation_runtime_fallback fromToolId=codex toToolId=opencode',
        ),
        'runner_generation_tool_source=fallback_after_runtime_error toolId=opencode configId=cfg-opencode',
      ]),
    );
  });

  it('should not runtime-fallback on non-recoverable execution failures', async () => {
    const cursorDefault = buildConfig({
      id: 'cfg-cursor',
      toolId: 'cursor-agent',
      configJson: '{"model":"composer 2 fast"}',
    });
    const codexDefault = buildConfig({
      id: 'cfg-codex',
      toolId: 'codex',
      configJson: '{"model":"gpt-5.4"}',
    });
    const { service, invokeCliWithPrompt } = createService({
      businessLine: {
        defaultAgentCliToolId: 'cursor-agent',
      },
      configsByTool: {
        'cursor-agent': [cursorDefault],
        codex: [codexDefault],
      },
      invokeImpl: () =>
        Promise.reject(
          new Error('AI CLI exited with code 1: malformed response envelope'),
        ),
    });

    const result = await service.generateFromFullScan(
      'bl-1',
      createWorkspaceScanRequest(),
    );

    expect(invokeCliWithPrompt).toHaveBeenCalledTimes(1);
    expect(result.orchestration).toBeNull();
    expect(result.warnings).toEqual(
      expect.arrayContaining([
        'AI full scan failed: AI CLI exited with code 1: malformed response envelope',
      ]),
    );
  });
});
