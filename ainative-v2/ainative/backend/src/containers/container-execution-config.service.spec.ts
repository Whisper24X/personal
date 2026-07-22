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

    expect(service.getMaxContainersPerProject()).toBe(1);
    expect(service.getSandboxProfile()).toBe('runner-only');
    expect(service.usesSandboxEntrypoint()).toBe(true);
    expect(service.getRunnerNetworkMode()).toBe('bridge');
    expect(service.shouldExposeSandboxPort()).toBe(true);
    expect(service.getRunnerReadinessProbeUrl()).toBe(
      'http://127.0.0.1:8080/health',
    );
    expect(service.getRunnerStartTimeoutMs()).toBe(30_000);
    expect(service.getRunnerCpuLimit()).toBeUndefined();
    expect(service.resourceLimitsForProfile()).toEqual({});
    expect(service.getRunnerManagedVolumeTargets('/workspace')).toEqual([
      '/workspace/backend/node_modules',
      '/workspace/frontend/node_modules',
      '/workspace/logs',
      '/var/lib/ainative-runner-cache',
    ]);
  });

  it('should read max containers per project from env when configured', () => {
    const service = createService({
      AINATIVE_PROJECT_MAX_CONTAINERS_PER_PROJECT: '3',
    });

    expect(service.getMaxContainersPerProject()).toBe(3);
  });

  it('should fall back to the default max containers per project for invalid values', () => {
    const service = createService({
      AINATIVE_PROJECT_MAX_CONTAINERS_PER_PROJECT: '0',
    });

    expect(service.getMaxContainersPerProject()).toBe(1);
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
    expect(service.getRunnerManagedVolumeTargets('/workspace')).toEqual([
      '/workspace/backend/node_modules',
      '/workspace/frontend/node_modules',
      '/workspace/logs',
      '/var/lib/ainative-runner-cache',
    ]);
    expect(service.getRunnerCpuLimit()).toBeUndefined();
    expect(service.resourceLimitsForProfile()).toEqual({});
  });

  it('should respect global runtime size overrides when provided', () => {
    const service = createService({
      AINATIVE_TASK_SANDBOX_PROFILE: 'preview-web',
      AINATIVE_RUNNER_RUNTIME_PLATFORM: 'linux/amd64',
      AINATIVE_RUNNER_START_TIMEOUT_MS: '45000',
      AINATIVE_RUNNER_CPUS: '2',
      AINATIVE_RUNNER_MEMORY_MB: '4096',
      AINATIVE_RUNNER_PIDS_LIMIT: '512',
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
    expect(service.getRunnerCpuLimit()).toBe(2);
    expect(service.resourceLimitsForProfile()).toEqual({
      memoryMb: 4096,
      pidsLimit: 512,
    });
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

  it('should expose stable package manager caches for runner dependency reuse', () => {
    const service = createService({});

    expect(service.getRunnerDependencyCacheEnv()).toEqual({
      PNPM_STORE_DIR: '/var/lib/ainative-runner-cache/pnpm-store',
      npm_config_cache: '/var/lib/ainative-runner-cache/npm-cache',
      YARN_CACHE_FOLDER: '/var/lib/ainative-runner-cache/yarn-cache',
    });
  });

  it('should default shouldAddHostDockerInternalGateway to true', () => {
    const service = createService({});
    expect(service.shouldAddHostDockerInternalGateway()).toBe(true);
  });

  it('should disable host.docker.internal mapping when env is false', () => {
    const service = createService({
      AINATIVE_RUNNER_ADD_HOST_DOCKER_INTERNAL: 'false',
    });
    expect(service.shouldAddHostDockerInternalGateway()).toBe(false);
  });

  it('should only read project-level env overrides while runtime policy stays global', () => {
    const service = createService({
      AINATIVE_TASK_SANDBOX_PROFILE: 'runner-only',
      AINATIVE_RUNNER_RUNTIME_PLATFORM: 'linux/arm64',
      AINATIVE_RUNNER_CPUS: '2.5',
      AINATIVE_RUNNER_MEMORY_MB: '4096',
      AINATIVE_RUNNER_PIDS_LIMIT: '512',
      AINATIVE_RUNNER_NETWORK_MODE: 'host',
      AINATIVE_RUNNER_EXPOSE_HOST_IP: '127.0.0.1',
      AINATIVE_RUNNER_EXPOSE_CONTAINER_PORT: '8080',
      AINATIVE_RUNNER_START_TIMEOUT_MS: '30000',
    });
    const project = createProject({
      containerRuntime: {
        sandboxProfile: 'preview-web',
        platform: 'linux/amd64',
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

    expect(service.getSandboxProfile(project as never)).toBe('runner-only');
    expect(service.getRunnerPlatform()).toBe('linux/arm64');
    expect(service.getRunnerPlatform(project as never)).toBe('linux/arm64');
    expect(service.usesSandboxEntrypoint(project as never)).toBe(true);
    expect(service.getRunnerNetworkMode(project as never)).toBe('host');
    expect(service.shouldExposeSandboxPort(project as never)).toBe(true);
    expect(service.getRunnerExposeHostIp(project as never)).toBe('127.0.0.1');
    expect(service.getRunnerExposeContainerPort(project as never)).toBe(8080);
    expect(service.getRunnerStartTimeoutMs(project as never)).toBe(30_000);
    expect(service.getRunnerCpuLimit(project as never)).toBe(2.5);
    expect(service.resourceLimitsForProfile(project as never)).toEqual({
      memoryMb: 4096,
      pidsLimit: 512,
    });
    expect(service.getRunnerEnv(project as never)).toEqual({
      PORT: '4173',
      NODE_ENV: 'development',
    });
  });

  it('should ignore legacy project-level port exposure fields', () => {
    const service = createService({
      AINATIVE_RUNNER_NETWORK_MODE: 'bridge',
      AINATIVE_RUNNER_EXPOSE_HOST_IP: '192.168.1.20',
      AINATIVE_RUNNER_EXPOSE_CONTAINER_PORT: '18080',
    });
    const project = createProject({
      containerRuntime: {
        networkMode: 'host',
        exposeHostIp: '10.0.0.10',
        exposeContainerPort: 4173,
      },
    });

    expect(service.getRunnerNetworkMode(project as never)).toBe('bridge');
    expect(service.getRunnerExposeHostIp(project as never)).toBe(
      '192.168.1.20',
    );
    expect(service.getRunnerExposeContainerPort(project as never)).toBe(18_080);
  });

  it('should ignore invalid runner platform values', () => {
    const service = createService({
      AINATIVE_RUNNER_RUNTIME_PLATFORM: 'amd64',
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

  it('should fall back to the legacy runtime platform env key', () => {
    const service = createService({
      AINATIVE_RUNNER_PLATFORM: 'linux/amd64',
    });

    expect(service.getRunnerPlatform()).toBe('linux/amd64');
  });

  it('should prefer the new runtime platform env key over the legacy key', () => {
    const service = createService({
      AINATIVE_RUNNER_RUNTIME_PLATFORM: 'linux/arm64',
      AINATIVE_RUNNER_PLATFORM: 'linux/amd64',
    });

    expect(service.getRunnerPlatform()).toBe('linux/arm64');
  });

  describe('getPreviewBridgeScriptUrl', () => {
    it('should return null when nginx inject is disabled', () => {
      const service = createService({
        AINATIVE_PREVIEW_BRIDGE_NGINX_INJECT: '0',
        AINATIVE_PREVIEW_BRIDGE_SCRIPT_URL:
          'https://app.example.com/preview-iframe-bridge.js',
        'app.frontendDomain': 'https://app.example.com',
      });

      expect(service.getPreviewBridgeScriptUrl()).toBeNull();
    });

    it('should use explicit script URL when set', () => {
      const service = createService({
        AINATIVE_PREVIEW_BRIDGE_SCRIPT_URL:
          'https://app.example.com/static/preview-iframe-bridge.js',
      });

      expect(service.getPreviewBridgeScriptUrl()).toBe(
        'https://app.example.com/static/preview-iframe-bridge.js',
      );
    });

    it('should compose from app.frontendDomain and AINATIVE_FRONTEND_BASE_PATH', () => {
      const service = createService({
        'app.frontendDomain': 'https://app.example.com',
        AINATIVE_FRONTEND_BASE_PATH: '/ainative/',
      });

      expect(service.getPreviewBridgeScriptUrl()).toBe(
        'https://app.example.com/ainative/preview-iframe-bridge.js',
      );
    });

    it('should return null for invalid explicit URL', () => {
      const service = createService({
        AINATIVE_PREVIEW_BRIDGE_SCRIPT_URL: 'not-a-url',
      });

      expect(service.getPreviewBridgeScriptUrl()).toBeNull();
    });

    it('should return null when neither explicit URL nor frontend domain is set', () => {
      const service = createService({});

      expect(service.getPreviewBridgeScriptUrl()).toBeNull();
    });
  });
});
