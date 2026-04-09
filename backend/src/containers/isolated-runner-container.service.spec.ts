import { IsolatedRunnerContainerService } from './isolated-runner-container.service';

describe('IsolatedRunnerContainerService', () => {
  it('should pass docker platform and resource flags when starting a runner container', async () => {
    const service = new IsolatedRunnerContainerService();
    const execDockerCapture = jest
      .fn()
      .mockResolvedValueOnce('ainative-task-task-1-workspace-logs\n')
      .mockResolvedValueOnce('container-1\n');
    const execDocker = jest.fn().mockResolvedValue(undefined);
    (service as any).execDockerCapture = execDockerCapture;
    (service as any).execDocker = execDocker;
    (service as any).inspectById = jest.fn().mockResolvedValue({
      id: 'container-1',
      status: 'running',
      running: true,
      image: 'ainative/runner:latest',
      platform: 'linux/amd64',
      publishedPorts: [],
    });

    await service.run({
      containerName: 'ainative-task-task-1',
      image: 'ainative/runner:latest',
      worktreePath: '/tmp/worktrees/wk-task-1',
      workspaceMount: '/workspace',
      command: ['/usr/local/bin/ainative-runner-entrypoint'],
      platform: 'linux/amd64',
      cpuLimit: 2,
      resourceLimits: {
        memoryMb: 4096,
        pidsLimit: 512,
      },
      sharedVolumeMounts: [
        {
          name: 'ainative-go-mod-cache',
          target: '/go/pkg/mod',
        },
        {
          name: 'ainative-go-build-cache',
          target: '/root/.cache/go-build',
        },
      ],
      managedVolumeMounts: [
        {
          name: 'ainative-task-task-1-workspace-logs',
          target: '/workspace/logs',
          labels: {
            'ainative.runner-managed': 'true',
            'ainative.container-name': 'ainative-task-task-1',
          },
        },
      ],
      startTimeoutMs: 1000,
      networkMode: 'bridge',
    });

    expect(execDockerCapture).toHaveBeenCalledWith(
      expect.arrayContaining([
        'volume',
        'create',
        '--label',
        'ainative.runner-managed=true',
        '--label',
        'ainative.container-name=ainative-task-task-1',
        'ainative-task-task-1-workspace-logs',
      ]),
    );
    expect(execDockerCapture).toHaveBeenCalledWith(
      expect.arrayContaining([
        '--platform',
        'linux/amd64',
        '--cpus',
        '2',
        '--memory',
        '4096m',
        '--pids-limit',
        '512',
        'ainative-go-mod-cache:/go/pkg/mod',
        'ainative-go-build-cache:/root/.cache/go-build',
        'ainative-task-task-1-workspace-logs:/workspace/logs',
      ]),
    );
    expect(execDocker).not.toHaveBeenCalled();
  });

  it('should remove managed volumes after removing the container', async () => {
    const service = new IsolatedRunnerContainerService();
    const execDocker = jest.fn().mockResolvedValue(undefined);
    const execDockerCapture = jest
      .fn()
      .mockResolvedValueOnce('ainative-task-task-1-workspace-logs\n');
    (service as any).execDocker = execDocker;
    (service as any).execDockerCapture = execDockerCapture;

    await service.remove('ainative-task-task-1');

    expect(execDocker).toHaveBeenNthCalledWith(1, [
      'rm',
      '-f',
      '-v',
      'ainative-task-task-1',
    ]);
    expect(execDockerCapture).toHaveBeenCalledWith([
      'volume',
      'ls',
      '--quiet',
      '--filter',
      'label=ainative.runner-managed=true',
      '--filter',
      'label=ainative.container-name=ainative-task-task-1',
    ]);
    expect(execDocker).toHaveBeenNthCalledWith(2, [
      'volume',
      'rm',
      '-f',
      'ainative-task-task-1-workspace-logs',
    ]);
  });

  it('should resolve the running container platform from the backing image', async () => {
    const service = new IsolatedRunnerContainerService();
    (service as any).execDockerCapture = jest
      .fn()
      .mockImplementation((args: string[]) => {
        if (args[0] === 'inspect') {
          return Promise.resolve(
            JSON.stringify({
              Id: 'container-1',
              Image: 'sha256:image-id',
              State: {
                Status: 'running',
                Running: true,
              },
              Config: {
                Image: 'ainative/runner:latest',
              },
              NetworkSettings: {
                Ports: {},
              },
            }),
          );
        }

        if (args[0] === 'image') {
          return Promise.resolve('linux/arm64/v8\n');
        }

        return Promise.reject(
          new Error(`unexpected docker args: ${args.join(' ')}`),
        );
      });

    await expect(service.inspect('ainative-task-task-1')).resolves.toEqual(
      expect.objectContaining({
        id: 'container-1',
        image: 'ainative/runner:latest',
        platform: 'linux/arm64/v8',
      }),
    );
  });
});
