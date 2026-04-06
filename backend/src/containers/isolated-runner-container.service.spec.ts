import { IsolatedRunnerContainerService } from './isolated-runner-container.service';

describe('IsolatedRunnerContainerService', () => {
  it('should pass docker platform when starting a runner container', async () => {
    const service = new IsolatedRunnerContainerService();
    const execDockerCapture = jest.fn().mockResolvedValue('container-1\n');
    (service as any).execDockerCapture = execDockerCapture;
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
      startTimeoutMs: 1000,
      networkMode: 'bridge',
    });

    expect(execDockerCapture).toHaveBeenCalledWith(
      expect.arrayContaining(['--platform', 'linux/amd64']),
    );
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
