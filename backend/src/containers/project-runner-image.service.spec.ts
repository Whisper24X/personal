import { ConfigService } from '@nestjs/config';
import { ContainerExecutionConfigService } from './container-execution-config.service';
import { ProjectRunnerImageService } from './project-runner-image.service';

describe('ProjectRunnerImageService', () => {
  const createService = () => {
    const configService = {
      get: jest.fn((key: string) => {
        if (key === 'AINATIVE_RUNNER_IMAGE') {
          return 'ainative/runner:latest';
        }
        return undefined;
      }),
    } as unknown as ConfigService;

    return new ProjectRunnerImageService(
      new ContainerExecutionConfigService(configService),
    );
  };

  it('should always resolve to the shared global runner image', async () => {
    const service = createService();

    await expect(service.resolveRunnerImage()).resolves.toBe(
      'ainative/runner:latest',
    );
    await expect(
      service.resolveRunnerImage({
        id: 'project-1',
        businessLineId: 'business-line-1',
        name: 'AINative Web',
        description: null,
        gitUrl: 'git@example.com:ainative/web.git',
        defaultBranch: 'main',
        configJson: {
          runnerTemplate: {
            dockerfileRunner: 'FROM node:20',
          },
          containerRuntime: {
            sandboxProfile: 'preview-web',
          },
        },
        createdAt: new Date('2026-03-27T10:00:00.000Z'),
        updatedAt: new Date('2026-03-27T10:00:00.000Z'),
        deletedAt: null,
      } as never),
    ).resolves.toBe('ainative/runner:latest');
  });
});
