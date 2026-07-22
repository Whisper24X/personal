import { RunnerGenerationService } from './runner-generation.service';

describe('RunnerGenerationService project-level generation', () => {
  it('should use project.businessLineId when invoking project-level runner generation', async () => {
    const projectRepository = {
      findById: jest.fn().mockResolvedValue({
        id: 'project-1',
        businessLineId: 'business-line-1',
        configJson: {
          subRepos: [
            {
              prefix: 'yanxue',
              url: 'git@example.com:backend/yanxue.git',
              branch: 'main',
            },
          ],
        },
      }),
      update: jest.fn(),
    };

    const service = new RunnerGenerationService(
      { get: jest.fn() } as never,
      { findAllWithPagination: jest.fn(), findById: jest.fn() } as never,
      projectRepository as never,
      {} as never,
      {} as never,
      {} as never,
    );

    const generateRunnerConfigSpy = jest
      .spyOn(service as any, 'generateRunnerConfig')
      .mockResolvedValue({
        status: 'failed',
        error: 'stubbed',
      });

    await service.generateForProject('project-1');

    expect(generateRunnerConfigSpy).toHaveBeenCalledWith(
      'business-line-1',
      [
        {
          prefix: 'yanxue',
          url: 'git@example.com:backend/yanxue.git',
          branch: 'main',
        },
      ],
      'project-level',
      {
        enhancedRetry: false,
        triggerReason: undefined,
      },
    );
  });

  it('should overwrite project runnerOrchestration when project-level generation is injectable but still needs review', async () => {
    const projectRepository = {
      findById: jest.fn().mockResolvedValue({
        id: 'project-1',
        businessLineId: 'business-line-1',
        configJson: {
          subRepos: [
            {
              prefix: 'yanxue',
              url: 'git@example.com:backend/yanxue.git',
              branch: 'main',
            },
          ],
          containerRuntime: {
            runnerOrchestration: {
              services: [
                {
                  name: 'existing',
                  workdir: 'yanxue',
                  command: 'go run .',
                  port: 8000,
                },
              ],
              routes: [
                {
                  path: '/',
                  action: 'proxy',
                  match: 'prefix',
                  service: 'existing',
                },
              ],
              preview: { service: 'existing', path: '/' },
            },
          },
        },
      }),
      update: jest.fn(),
    };

    const service = new RunnerGenerationService(
      { get: jest.fn() } as never,
      { findAllWithPagination: jest.fn(), findById: jest.fn() } as never,
      projectRepository as never,
      {} as never,
      {} as never,
      {} as never,
    );

    jest.spyOn(service as any, 'generateRunnerConfig').mockResolvedValue({
      status: 'needsManualReview',
      orchestration: {
        services: [
          {
            name: 'new-web',
            workdir: 'yanxue',
            command: 'go run .',
            port: 9000,
          },
        ],
      },
      error: 'missing preview route',
    });

    const result = await service.generateForProject('project-1');

    expect(projectRepository.update).toHaveBeenCalledWith(
      'project-1',
      expect.objectContaining({
        configJson: expect.objectContaining({
          containerRuntime: expect.objectContaining({
            runnerOrchestration: expect.objectContaining({
              services: expect.arrayContaining([
                expect.objectContaining({
                  name: 'new-web',
                  port: 9000,
                }),
              ]),
            }),
          }),
        }),
      }),
    );
    expect(result).toEqual(
      expect.objectContaining({
        written: true,
        verified: false,
        status: 'written',
      }),
    );
  });

  it('should overwrite project runnerOrchestration when verification is skipped but config is injectable', async () => {
    const projectRepository = {
      findById: jest.fn().mockResolvedValue({
        id: 'project-1',
        businessLineId: 'business-line-1',
        configJson: {
          subRepos: [
            {
              prefix: 'yanxue',
              url: 'git@example.com:backend/yanxue.git',
              branch: 'main',
            },
          ],
        },
      }),
      update: jest.fn(),
    };

    const service = new RunnerGenerationService(
      { get: jest.fn() } as never,
      { findAllWithPagination: jest.fn(), findById: jest.fn() } as never,
      projectRepository as never,
      {} as never,
      {} as never,
      {} as never,
    );

    jest.spyOn(service as any, 'generateRunnerConfig').mockResolvedValue({
      status: 'ready',
      orchestration: {
        services: [
          {
            name: 'yanxue',
            workdir: 'yanxue',
            command: 'go run .',
            port: 9000,
          },
        ],
        routes: [
          {
            path: '/api/',
            action: 'proxy',
            match: 'prefix',
            service: 'yanxue',
          },
        ],
        preview: { service: 'yanxue', path: '/api/' },
      },
      meta: {
        source: 'ai-full-scan',
        generatedAt: '2026-06-28T00:00:00.000Z',
        coverageStatus: 'valid',
        verificationStatus: 'skipped',
        inputFingerprint: 'runner-fp-1',
      },
    });

    const result = await service.generateForProject('project-1');

    expect(projectRepository.update).toHaveBeenCalledWith(
      'project-1',
      expect.objectContaining({
        configJson: expect.objectContaining({
          containerRuntime: expect.objectContaining({
            runnerOrchestration: expect.objectContaining({
              services: expect.any(Array),
              generatedMeta: expect.objectContaining({
                verificationStatus: 'skipped',
                runnerFingerprint: 'runner-fp-1',
              }),
            }),
          }),
        }),
      }),
    );
    expect(result).toEqual(
      expect.objectContaining({
        written: true,
        verified: false,
        status: 'written',
      }),
    );
  });

  it('should overwrite project runnerOrchestration when config is injectable but verification is still running', async () => {
    const projectRepository = {
      findById: jest.fn().mockResolvedValue({
        id: 'project-1',
        businessLineId: 'business-line-1',
        configJson: {
          subRepos: [
            {
              prefix: 'yanxue',
              url: 'git@example.com:backend/yanxue.git',
              branch: 'main',
            },
          ],
        },
      }),
      update: jest.fn(),
    };

    const service = new RunnerGenerationService(
      { get: jest.fn() } as never,
      { findAllWithPagination: jest.fn(), findById: jest.fn() } as never,
      projectRepository as never,
      {} as never,
      {} as never,
      {} as never,
    );

    jest.spyOn(service as any, 'generateRunnerConfig').mockResolvedValue({
      status: 'generated',
      orchestration: {
        services: [
          {
            name: 'trip-miniprogram',
            workdir: 'trip-miniprogram',
            command: 'pnpm dev',
            port: 8200,
          },
        ],
        routes: [
          {
            path: '/trip-miniprogram/',
            action: 'proxy',
            match: 'prefix',
            service: 'trip-miniprogram',
          },
        ],
      },
      meta: {
        source: 'ai-full-scan',
        generatedAt: '2026-06-28T00:00:00.000Z',
        coverageStatus: 'incomplete',
        verificationStatus: 'running',
      },
    });

    const result = await service.generateForProject('project-1');

    expect(projectRepository.update).toHaveBeenCalledWith(
      'project-1',
      expect.objectContaining({
        configJson: expect.objectContaining({
          containerRuntime: expect.objectContaining({
            runnerOrchestration: expect.objectContaining({
              services: expect.any(Array),
              generatedMeta: expect.objectContaining({
                verificationStatus: 'running',
              }),
            }),
          }),
        }),
      }),
    );
    expect(result).toEqual(
      expect.objectContaining({
        written: true,
        verified: false,
        status: 'written',
      }),
    );
  });

  it('should pass enhanced retry options through project-level generation when requested', async () => {
    const projectRepository = {
      findById: jest.fn().mockResolvedValue({
        id: 'project-1',
        businessLineId: 'business-line-1',
        configJson: {
          subRepos: [
            {
              prefix: 'yanxue',
              url: 'git@example.com:backend/yanxue.git',
              branch: 'main',
            },
          ],
        },
      }),
      update: jest.fn(),
    };

    const service = new RunnerGenerationService(
      { get: jest.fn() } as never,
      { findAllWithPagination: jest.fn(), findById: jest.fn() } as never,
      projectRepository as never,
      {} as never,
      {} as never,
      {} as never,
    );

    const generateRunnerConfigSpy = jest
      .spyOn(service as any, 'generateRunnerConfig')
      .mockResolvedValue({
        status: 'failed',
        error: 'stubbed',
      });

    await service.generateForProject('project-1', {
      enhancedRetry: true,
      triggerReason: 'manual_reset_config',
    });

    expect(generateRunnerConfigSpy).toHaveBeenCalledWith(
      'business-line-1',
      [
        {
          prefix: 'yanxue',
          url: 'git@example.com:backend/yanxue.git',
          branch: 'main',
        },
      ],
      'project-level',
      {
        enhancedRetry: true,
        triggerReason: 'manual_reset_config',
      },
    );
  });
});
