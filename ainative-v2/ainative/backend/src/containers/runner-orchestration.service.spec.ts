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
      AINATIVE_TASK_SANDBOX_PROFILE: 'preview-web',
      AINATIVE_RUNNER_EXPOSE_HOST_IP: '127.0.0.1',
      AINATIVE_RUNNER_CPUS: '2',
      AINATIVE_RUNNER_MEMORY_MB: '4096',
      AINATIVE_RUNNER_PIDS_LIMIT: '512',
    });

    const configFile = service.buildProjectRunnerConfigFile(
      createProject() as never,
    );

    expect(configFile).toMatchObject({
      version: 1,
      runtime: {
        networkMode: 'bridge',
        listenPort: 8080,
        cpuLimit: 2,
        resourceLimits: {
          memoryMb: 4096,
          pidsLimit: 512,
        },
        sharedVolumes: expect.arrayContaining([
          {
            name: 'ainative-go-mod-cache',
            target: '/go/pkg/mod',
          },
          {
            name: 'ainative-go-build-cache',
            target: '/root/.cache/go-build',
          },
        ]),
      },
      orchestration: {
        services: expect.arrayContaining([
          expect.objectContaining({
            name: 'ainative-backend',
            workdir: 'ainative-backend',
          }),
          expect.objectContaining({
            name: 'ainative-shadow',
            workdir: 'ainative-shadow',
          }),
          expect.objectContaining({
            name: 'ainative-app',
            workdir: 'ainative-app',
            env: expect.objectContaining({
              AINATIVE_PREVIEW_HTML_INJECT: '1',
              AINATIVE_PREVIEW_HMR_PATH: '/_ainative/vite-hmr/ainative-app',
              AINATIVE_PREVIEW_SERVICE_NAME: 'ainative-app',
              AINATIVE_PREVIEW_SERVICE_PORT: '8200',
            }),
          }),
        ]),
        routes: expect.arrayContaining([
          expect.objectContaining({
            path: '^/api/.*\\.(ts|js|mjs|vue|less|css|scss|map)$',
            service: 'ainative-app',
            upstreamPath: '/',
          }),
          expect.objectContaining({
            path: '/api/',
            service: 'ainative-backend',
            upstreamPath: '/',
          }),
          expect.objectContaining({
            path: '/_ainative/vite-hmr/ainative-app',
            service: 'ainative-app',
            upstreamPath: '/',
            websocket: true,
          }),
          expect.objectContaining({
            path: '/shadow/',
            service: 'ainative-shadow',
          }),
          expect.objectContaining({
            path: '/app/',
            service: 'ainative-app',
          }),
          expect.objectContaining({ path: '/', service: 'ainative-app' }),
        ]),
        homepage: expect.objectContaining({
          title: 'AINative Workspace',
        }),
        preview: {
          service: 'ainative-app',
          path: '/',
        },
      },
    });

    const routes = configFile?.orchestration.routes ?? [];
    const staticApiRouteIndex = routes.findIndex(
      (route) => route.path === '^/api/.*\\.(ts|js|mjs|vue|less|css|scss|map)$',
    );
    const backendApiRouteIndex = routes.findIndex(
      (route) => route.path === '/api/',
    );
    expect(staticApiRouteIndex).toBeGreaterThanOrEqual(0);
    expect(backendApiRouteIndex).toBeGreaterThan(staticApiRouteIndex);
  });

  it('should prefer configured runner orchestration over profile defaults', () => {
    const service = createService({
      AINATIVE_TASK_SANDBOX_PROFILE: 'preview-web',
      AINATIVE_RUNNER_EXPOSE_HOST_IP: '127.0.0.1',
    });

    const configFile = service.buildProjectRunnerConfigFile(
      createProject({
        containerRuntime: {
          runnerOrchestration: {
            manuallyLocked: true,
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
            preview: {
              service: 'api',
              path: '/api/',
            },
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
    expect(configFile?.orchestration.preview).toEqual({
      service: 'api',
      path: '/api/',
    });
  });

  it('should merge default shared volumes with configured shared volumes', () => {
    const service = createService({
      AINATIVE_TASK_SANDBOX_PROFILE: 'runner-only',
    });

    const configFile = service.buildProjectRunnerConfigFile(
      createProject({
        containerRuntime: {
          runnerOrchestration: {
            manuallyLocked: true,
            services: [
              {
                name: 'api',
                workdir: 'services/api',
                command: 'pnpm dev',
              },
            ],
            sharedVolumes: [
              {
                name: 'ainative-pnpm-store',
                target: '/pnpm/store',
              },
            ],
          },
        },
      }) as never,
    );

    expect(configFile?.runtime.sharedVolumes).toEqual(
      expect.arrayContaining([
        {
          name: 'ainative-go-mod-cache',
          target: '/go/pkg/mod',
        },
        {
          name: 'ainative-go-build-cache',
          target: '/root/.cache/go-build',
        },
        {
          name: 'ainative-pnpm-store',
          target: '/pnpm/store',
        },
      ]),
    );
  });

  it('should derive managed volume targets from services with install commands', () => {
    const service = createService();

    const mounts = service.buildManagedVolumeTargets(
      '/workspace',
      createProject({
        containerRuntime: {
          runnerOrchestration: {
            manuallyLocked: true,
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
      '/var/lib/ainative-runner-cache',
      '/workspace/frontend/node_modules',
    ]);
  });
});
