import { ConfigService } from '@nestjs/config';
import { ContainerExecutionConfigService } from './container-execution-config.service';

describe('ContainerExecutionConfigService', () => {
  const createService = (
    values: Record<string, string | undefined>,
  ): ContainerExecutionConfigService => {
    const configService = {
      get: jest.fn((key: string) => values[key]),
    } as unknown as ConfigService;

    return new ContainerExecutionConfigService(configService);
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

  it('should give runner-only profile the shared preview runtime defaults', () => {
    const service = createService({});

    expect(service.getSandboxProfile()).toBe('runner-only');
    expect(service.usesSandboxEntrypoint()).toBe(true);
    expect(service.getRunnerNetworkMode()).toBe('bridge');
    expect(service.shouldExposeSandboxPort()).toBe(true);
    expect(service.getRunnerReadinessProbeUrl()).toBe(
      'http://127.0.0.1:8080/health',
    );
    expect(service.getRunnerStartTimeoutMs()).toBe(30_000);
    expect(service.getRunnerAnonymousVolumeMounts('/workspace')).toEqual([
      '/workspace/backend/node_modules',
      '/workspace/frontend/node_modules',
      '/workspace/logs',
    ]);
  });

  it('should use sandbox defaults for preview-web profile', () => {
    const service = createService({
      AINATIVE_TASK_SANDBOX_PROFILE: 'preview-web',
    });

    expect(service.getSandboxProfile()).toBe('preview-web');
    expect(service.usesSandboxEntrypoint()).toBe(true);
    expect(service.getRunnerNetworkMode()).toBe('bridge');
    expect(service.shouldExposeSandboxPort()).toBe(true);
    expect(service.getRunnerReadinessProbeUrl()).toBe(
      'http://127.0.0.1:8080/health',
    );
    expect(service.getRunnerStartTimeoutMs()).toBe(300_000);
    expect(service.getRunnerAnonymousVolumeMounts('/workspace')).toEqual([
      '/workspace/backend/node_modules',
      '/workspace/frontend/node_modules',
      '/workspace/logs',
    ]);
    expect(service.resourceLimitsForProfile()).toEqual({
      memoryMb: 2048,
      pidsLimit: 256,
    });
  });

  it('should respect sandbox overrides when provided', () => {
    const service = createService({
      AINATIVE_TASK_SANDBOX_PROFILE: 'preview-web',
      AINATIVE_RUNNER_PLATFORM: 'linux/amd64',
      AINATIVE_RUNNER_START_TIMEOUT_MS: '45000',
      AINATIVE_RUNNER_READINESS_URL: 'http://127.0.0.1:18080/healthz',
      AINATIVE_RUNNER_NETWORK_MODE: 'bridge',
      AINATIVE_RUNNER_EXPOSE_HOST_IP: '192.168.1.20',
      AINATIVE_RUNNER_EXPOSE_CONTAINER_PORT: '18080',
      AINATIVE_RUNNER_EXPOSE_PORT_RANGE_START: '49000',
      AINATIVE_RUNNER_EXPOSE_PORT_RANGE_END: '49020',
    });

    expect(service.getSandboxProfile()).toBe('preview-web');
    expect(service.getRunnerPlatform()).toBe('linux/amd64');
    expect(service.getRunnerStartTimeoutMs()).toBe(45_000);
    expect(service.getRunnerNetworkMode()).toBe('bridge');
    expect(service.getRunnerExposeHostIp()).toBe('192.168.1.20');
    expect(service.getRunnerExposeContainerPort()).toBe(18_080);
    expect(service.getRunnerExposePortRange()).toEqual({
      start: 49_000,
      end: 49_020,
    });
    expect(service.getRunnerReadinessProbeUrl()).toBe(
      'http://127.0.0.1:18080/healthz',
    );
  });

  it('should read the global preview base url when configured', () => {
    const service = createService({
      AINATIVE_PREVIEW_BASE_URL: 'https://preview.example.com/root/',
    });

    expect(service.getPreviewBaseUrl()).toBe(
      'https://preview.example.com/root/',
    );
  });

  it('should expose GitLab credentials only through bootstrap env', () => {
    const service = createService({
      GITLAB_USERNAME: 'oauth2',
      GITLAB_TOKEN: 'token-value',
    });

    expect(service.getRunnerBootstrapEnv()).toEqual({
      GITLAB_USERNAME: 'oauth2',
      GITLAB_TOKEN: 'token-value',
    });
    expect(service.getRunnerEnv()).toEqual({});
  });

  it('should prefer project container runtime overrides over global defaults', () => {
    const service = createService({
      AINATIVE_TASK_SANDBOX_PROFILE: 'runner-only',
      AINATIVE_RUNNER_PLATFORM: 'linux/arm64',
      AINATIVE_RUNNER_NETWORK_MODE: 'host',
      AINATIVE_RUNNER_EXPOSE_LOCAL: 'true',
      AINATIVE_RUNNER_EXPOSE_HOST_IP: '127.0.0.1',
      AINATIVE_RUNNER_EXPOSE_CONTAINER_PORT: '8080',
      AINATIVE_RUNNER_START_TIMEOUT_MS: '30000',
    });
    const project = createProject({
      containerRuntime: {
        sandboxProfile: 'preview-web',
        platform: 'linux/amd64',
        networkMode: 'bridge',
        exposeLocal: false,
        exposeHostIp: '192.168.50.8',
        exposeContainerPort: 4173,
        startTimeoutMs: 90000,
        resourceLimits: {
          memoryMb: 3072,
          pidsLimit: 300,
        },
        env: {
          PORT: '4173',
          NODE_ENV: 'development',
        },
      },
    });

    expect(service.getSandboxProfile(project as never)).toBe('preview-web');
    expect(service.getRunnerPlatform()).toBe('linux/arm64');
    expect(service.getRunnerPlatform(project as never)).toBe('linux/amd64');
    expect(service.usesSandboxEntrypoint(project as never)).toBe(true);
    expect(service.getRunnerNetworkMode(project as never)).toBe('bridge');
    expect(service.shouldExposeSandboxPort(project as never)).toBe(true);
    expect(service.getRunnerExposeHostIp(project as never)).toBe(
      '192.168.50.8',
    );
    expect(service.getRunnerExposeContainerPort(project as never)).toBe(4173);
    expect(service.getRunnerStartTimeoutMs(project as never)).toBe(90_000);
    expect(service.resourceLimitsForProfile(project as never)).toEqual({
      memoryMb: 3072,
      pidsLimit: 300,
    });
    expect(service.getRunnerEnv(project as never)).toEqual({
      PORT: '4173',
      NODE_ENV: 'development',
    });
  });

  it('should ignore invalid runner platform values', () => {
    const service = createService({
      AINATIVE_RUNNER_PLATFORM: 'amd64',
    });

    expect(service.getRunnerPlatform()).toBeNull();
    expect(
      service.getRunnerPlatform(
        createProject({
          containerRuntime: {
            platform: 'linux amd64',
          },
        }) as never,
      ),
    ).toBeNull();
  });
});
