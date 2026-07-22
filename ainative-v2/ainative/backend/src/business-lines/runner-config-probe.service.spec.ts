import { ConfigService } from '@nestjs/config';
import { ContainerExecutionConfigService } from '../containers/container-execution-config.service';
import { IsolatedRunnerContainerService } from '../containers/isolated-runner-container.service';
import { ProjectRunnerImageService } from '../containers/project-runner-image.service';
import { RunnerConfigProbeService } from './runner-config-probe.service';

describe('RunnerConfigProbeService', () => {
  const orchestration = {
    services: [
      {
        name: 'web',
        workdir: 'web',
        command: 'npm run dev',
        port: 5173,
      },
    ],
    routes: [{ path: '/', action: 'proxy' as const, service: 'web' }],
    preview: { service: 'web', path: '/' },
  };

  function createService(options?: {
    mode?: string;
    runRejects?: Error;
    timeoutMs?: string;
    execOutputs?: string[];
  }): {
    service: RunnerConfigProbeService;
    isolatedRunner: {
      run: jest.Mock;
      remove: jest.Mock;
      execInContainer: jest.Mock;
    };
  } {
    const configService = {
      get: jest.fn((key: string) => {
        if (key === 'AINATIVE_RUNNER_GENERATION_PROBE_MODE') {
          return options?.mode ?? 'warn';
        }
        if (key === 'AINATIVE_RUNNER_GENERATION_PROBE_TIMEOUT_MS') {
          return options?.timeoutMs;
        }
        return undefined;
      }),
    } as unknown as ConfigService;
    const containerConfig = {
      getRunnerExposeContainerPort: jest.fn(() => 8080),
      getRunnerEnv: jest.fn(() => ({})),
      getRunnerPlatform: jest.fn(() => null),
      shouldAddHostDockerInternalGateway: jest.fn(() => true),
      getRunnerCpuLimit: jest.fn(() => undefined),
      resourceLimitsForProfile: jest.fn(() => ({})),
    } as unknown as ContainerExecutionConfigService;
    const isolatedRunner = {
      run: jest.fn(
        options?.runRejects
          ? () => Promise.reject(options.runRejects)
          : () =>
              Promise.resolve({
                containerId: 'container-1',
                publishedPorts: [],
              }),
      ),
      remove: jest.fn(() => Promise.resolve()),
      execInContainer: jest.fn(() =>
        Promise.resolve(options?.execOutputs?.shift() ?? 'HTTP:200'),
      ),
    };
    const imageService = {
      resolveRunnerImage: jest.fn(() =>
        Promise.resolve('ainative/runner:latest'),
      ),
    } as unknown as ProjectRunnerImageService;

    return {
      service: new RunnerConfigProbeService(
        configService,
        containerConfig,
        isolatedRunner as unknown as IsolatedRunnerContainerService,
        imageService,
      ),
      isolatedRunner,
    };
  }

  it('should skip probe when mode is off', async () => {
    const { service, isolatedRunner } = createService({ mode: 'off' });

    await expect(
      service.probe({
        orchestration,
        workspacePath: '/tmp/workspace',
        fingerprint: 'abc',
      }),
    ).resolves.toMatchObject({ status: 'skipped', mode: 'off' });
    expect(isolatedRunner.run).not.toHaveBeenCalled();
  });

  it('should run runner image default entrypoint with injected config', async () => {
    const { service, isolatedRunner } = createService();

    await expect(
      service.probe({
        orchestration,
        workspacePath: '/tmp/workspace',
        fingerprint: 'abc',
      }),
    ).resolves.toMatchObject({ status: 'passed', mode: 'warn' });

    expect(isolatedRunner.run).toHaveBeenCalledWith(
      expect.objectContaining({
        image: 'ainative/runner:latest',
        useImageDefaultCommand: true,
        env: expect.objectContaining({
          AINATIVE_RUNNER_CONFIG_JSON: JSON.stringify(orchestration),
          AINATIVE_RUNNER_LISTEN_PORT: '8080',
          AINATIVE_RUNNER_WORKSPACE: '/workspace',
        }),
      }),
    );
    expect(isolatedRunner.remove).toHaveBeenCalledWith(
      expect.stringContaining('ainative-runner-probe-abc'),
    );
  });

  it('should fail when any homepage route returns a 5xx status', async () => {
    const failingOrchestration = {
      ...orchestration,
      routes: [
        { path: '/', action: 'proxy' as const, service: 'web' },
        { path: '/admin/', action: 'proxy' as const, service: 'web' },
      ],
      homepage: {
        links: [{ label: 'admin', path: '/admin/' }],
      },
    };
    const { service } = createService({
      timeoutMs: '1',
      execOutputs: ['HTTP:502', '', '', ''],
    });

    await expect(
      service.probe({
        orchestration: failingOrchestration,
        workspacePath: '/tmp/workspace',
        fingerprint: 'abc',
      }),
    ).resolves.toMatchObject({
      status: 'failed',
      failureKind: 'route-http-status',
      routeResults: expect.arrayContaining([
        expect.objectContaining({
          path: '/admin/',
          status: 'failed',
          statusCode: 502,
        }),
      ]),
    });
  });

  it('should repair a failed route by probing the actual listening HTTP port', async () => {
    const { service } = createService({
      timeoutMs: '1',
      execOutputs: [
        'HTTP:502',
        'LISTEN 0 4096 127.0.0.1:5176 0.0.0.0:* users:(("node",pid=42,fd=19))',
        'Local: http://localhost:5176/',
        'HTTP:200',
        'service log preview',
        'HTTP:200',
      ],
    });

    await expect(
      service.probe({
        orchestration,
        workspacePath: '/tmp/workspace',
        fingerprint: 'abc',
      }),
    ).resolves.toMatchObject({
      status: 'passed',
      repaired: true,
      repairSummary: 'web: 5173 -> 5176',
      repairedOrchestration: {
        services: [expect.objectContaining({ name: 'web', port: 5176 })],
      },
    });
  });

  it('should keep a dependency startup failure as a failed route with logs', async () => {
    const { service } = createService({
      timeoutMs: '1',
      execOutputs: [
        'ERR:7:curl: (7) Failed to connect',
        '',
        '',
        'Error: Cannot find module @tarojs/plugin-framework-react',
      ],
    });

    await expect(
      service.probe({
        orchestration,
        workspacePath: '/tmp/workspace',
        fingerprint: 'abc',
      }),
    ).resolves.toMatchObject({
      status: 'failed',
      failureKind: 'route-unreachable',
      logsPreview: 'Error: Cannot find module @tarojs/plugin-framework-react',
      routeResults: [
        expect.objectContaining({
          status: 'failed',
          failureKind: 'route-unreachable',
        }),
      ],
    });
  });

  it('should classify readiness failures as preview unreachable', async () => {
    const error = new Error(
      'readiness probe http://127.0.0.1:8080/ did not pass',
    );
    Object.assign(error, { containerLogsPreview: 'nginx ok, app down' });
    const { service } = createService({ runRejects: error });

    await expect(
      service.probe({
        orchestration,
        workspacePath: '/tmp/workspace',
        fingerprint: 'abc',
      }),
    ).resolves.toMatchObject({
      status: 'failed',
      failureKind: 'preview-unreachable',
      logsPreview: 'nginx ok, app down',
    });
  });
});
