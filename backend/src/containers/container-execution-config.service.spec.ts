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

  it('should keep runner-only profile on sleep entrypoint defaults', () => {
    const service = createService({});

    expect(service.getSandboxProfile()).toBe('runner-only');
    expect(service.usesSandboxEntrypoint()).toBe(false);
    expect(service.getRunnerReadinessProbeUrl()).toBeNull();
    expect(service.getRunnerStartTimeoutMs()).toBe(30_000);
    expect(service.getRunnerAnonymousVolumeMounts('/workspace')).toEqual([]);
  });

  it('should use sandbox defaults for full-dev-sandbox profile', () => {
    const service = createService({
      AINATIVE_TASK_SANDBOX_PROFILE: 'full-dev-sandbox',
    });

    expect(service.getSandboxProfile()).toBe('full-dev-sandbox');
    expect(service.usesSandboxEntrypoint()).toBe(true);
    expect(service.getRunnerReadinessProbeUrl()).toBe(
      'http://127.0.0.1:8080/health',
    );
    expect(service.getRunnerStartTimeoutMs()).toBe(300_000);
    expect(service.getRunnerAnonymousVolumeMounts('/workspace')).toEqual([
      '/workspace/backend/node_modules',
      '/workspace/frontend/node_modules',
      '/workspace/logs',
    ]);
  });

  it('should respect sandbox overrides when provided', () => {
    const service = createService({
      AINATIVE_TASK_SANDBOX_PROFILE: 'preview-web',
      AINATIVE_RUNNER_START_TIMEOUT_MS: '45000',
      AINATIVE_RUNNER_READINESS_URL: 'http://127.0.0.1:18080/healthz',
    });

    expect(service.getSandboxProfile()).toBe('preview-web');
    expect(service.getRunnerStartTimeoutMs()).toBe(45_000);
    expect(service.getRunnerReadinessProbeUrl()).toBe(
      'http://127.0.0.1:18080/healthz',
    );
  });
});
