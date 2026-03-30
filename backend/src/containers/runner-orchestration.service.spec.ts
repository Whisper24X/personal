import { ConfigService } from '@nestjs/config';
import { ContainerExecutionConfigService } from './container-execution-config.service';
import { RunnerOrchestrationService } from './runner-orchestration.service';

describe('RunnerOrchestrationService', () => {
  const createService = (
    values: Record<string, string | undefined> = {},
  ): RunnerOrchestrationService => {
    const configService = {
      get: jest.fn((key: string) => values[key]),
    } as unknown as ConfigService;

    return new RunnerOrchestrationService(
      new ContainerExecutionConfigService(configService),
    );
  };

  const createProject = (configJson?: Record<string, unknown>) => ({
    id: 'project-1',
    businessLineId: 'business-line-1',
    name: 'AINative Web',
    description: null,
    gitUrl: 'git@example.com:ainative/web.git',
    defaultBranch: 'main',
    configJson: configJson ?? null,
    createdAt: new Date('2026-03-27T10:00:00.000Z'),
    updatedAt: new Date('2026-03-27T10:00:00.000Z'),
    deletedAt: null,
  });

  it('should synthesize preview-web orchestration defaults from the sandbox profile', () => {
    const service = createService({
      AINATIVE_RUNNER_EXPOSE_HOST_IP: '127.0.0.1',
    });

    const configFile = service.buildProjectRunnerConfigFile(
      createProject({
        containerRuntime: {
          sandboxProfile: 'preview-web',
        },
      }) as never,
    );

    expect(configFile).toMatchObject({
      version: 1,
      runtime: {
        hostIp: '127.0.0.1',
        containerPort: 8080,
      },
      orchestration: {
        services: expect.arrayContaining([
          expect.objectContaining({
            name: 'backend',
            workdir: 'backend',
          }),
          expect.objectContaining({ name: 'frontend', workdir: 'frontend' }),
        ]),
        routes: expect.arrayContaining([
          expect.objectContaining({
            path: '/api/',
            service: 'backend',
            upstreamPath: '/',
          }),
          expect.objectContaining({ path: '/', service: 'frontend' }),
        ]),
      },
    });
  });

  it('should prefer configured runner orchestration over profile defaults', () => {
    const service = createService({
      AINATIVE_RUNNER_EXPOSE_HOST_IP: '127.0.0.1',
    });

    const configFile = service.buildProjectRunnerConfigFile(
      createProject({
        containerRuntime: {
          sandboxProfile: 'preview-web',
          runnerOrchestration: {
            services: [
              {
                name: 'api',
                workdir: 'services/api',
                command: 'pnpm dev',
                port: 7000,
                installCommand: 'pnpm install',
              },
            ],
            routes: [
              {
                path: '/api/',
                service: 'api',
                upstreamPath: '/',
              },
            ],
          },
        },
      }) as never,
    );

    expect(configFile?.orchestration.services).toEqual([
      expect.objectContaining({
        name: 'api',
        workdir: 'services/api',
      }),
    ]);
    expect(configFile?.orchestration.routes).toEqual([
      expect.objectContaining({
        path: '/api/',
        service: 'api',
      }),
    ]);
  });

  it('should derive anonymous node_modules mounts from services with install commands', () => {
    const service = createService();

    const mounts = service.buildAnonymousVolumeMounts(
      '/workspace',
      createProject({
        containerRuntime: {
          runnerOrchestration: {
            services: [
              {
                name: 'backend',
                workdir: 'backend',
                command: 'npm run dev',
              },
              {
                name: 'frontend',
                workdir: 'frontend',
                command: 'pnpm dev',
                installCommand: 'pnpm install',
              },
            ],
          },
        },
      }) as never,
    );

    expect(mounts).toEqual([
      '/workspace/logs',
      '/workspace/frontend/node_modules',
    ]);
  });
});
