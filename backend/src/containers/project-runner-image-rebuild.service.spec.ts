import { Project } from '../projects/domain/project';
import { ProjectRunnerImageRebuildService } from './project-runner-image-rebuild.service';

const createProject = (): Project => ({
  id: 'project-1',
  businessLineId: 'business-line-1',
  name: 'AINative',
  description: 'test',
  gitUrl: 'git@example.com:group/ainative.git',
  defaultBranch: 'main',
  configJson: {},
  createdAt: new Date('2026-03-27T15:00:00.000Z'),
  updatedAt: new Date('2026-03-27T15:00:00.000Z'),
  deletedAt: null,
});

describe('ProjectRunnerImageRebuildService', () => {
  it('should persist success status after rebuild completes', async () => {
    const projectRepository = {
      findById: jest
        .fn()
        .mockResolvedValueOnce({
          ...createProject(),
          configJson: {
            runnerImageBuild: {
              status: 'building',
              startedAt: '2026-03-27T15:00:00.000Z',
              finishedAt: null,
              errorMessage: null,
              imageTag: null,
            },
          },
        })
        .mockResolvedValueOnce({
          ...createProject(),
          configJson: {
            runnerImageBuild: {
              status: 'building',
              startedAt: '2026-03-27T15:00:00.000Z',
              finishedAt: null,
              errorMessage: null,
              imageTag: null,
            },
          },
        }),
      update: jest.fn().mockResolvedValue(createProject()),
    };
    const projectRunnerImageService = {
      resolveRunnerImage: jest
        .fn()
        .mockResolvedValue('ainative/project-runner:project-1'),
    };
    const containerConfig = {
      getRunnerImage: jest.fn().mockReturnValue('ainative/runner:global'),
    };
    const service = new ProjectRunnerImageRebuildService(
      projectRepository as never,
      projectRunnerImageService as never,
      containerConfig as never,
    );

    service.scheduleProjectRebuild('project-1');
    await new Promise<void>((resolve) => setImmediate(resolve));
    await new Promise<void>((resolve) => setImmediate(resolve));

    expect(projectRunnerImageService.resolveRunnerImage).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'project-1',
      }),
    );
    expect(projectRepository.update).toHaveBeenCalledWith(
      'project-1',
      expect.objectContaining({
        configJson: expect.objectContaining({
          runnerImageBuild: expect.objectContaining({
            status: 'success',
            imageTag: 'ainative/project-runner:project-1',
            errorMessage: null,
          }),
        }),
      }),
    );
  });

  it('should persist failure status when rebuild throws', async () => {
    const projectRepository = {
      findById: jest
        .fn()
        .mockResolvedValueOnce({
          ...createProject(),
          configJson: {
            runnerImageBuild: {
              status: 'building',
              startedAt: '2026-03-27T15:00:00.000Z',
              finishedAt: null,
              errorMessage: null,
              imageTag: null,
            },
          },
        })
        .mockResolvedValueOnce({
          ...createProject(),
          configJson: {
            runnerImageBuild: {
              status: 'building',
              startedAt: '2026-03-27T15:00:00.000Z',
              finishedAt: null,
              errorMessage: null,
              imageTag: null,
            },
          },
        }),
      update: jest.fn().mockResolvedValue(createProject()),
    };
    const projectRunnerImageService = {
      resolveRunnerImage: jest
        .fn()
        .mockRejectedValue(new Error('docker build failed')),
    };
    const containerConfig = {
      getRunnerImage: jest.fn().mockReturnValue('ainative/runner:global'),
    };
    const service = new ProjectRunnerImageRebuildService(
      projectRepository as never,
      projectRunnerImageService as never,
      containerConfig as never,
    );

    service.scheduleProjectRebuild('project-1');
    await new Promise<void>((resolve) => setImmediate(resolve));
    await new Promise<void>((resolve) => setImmediate(resolve));

    expect(projectRepository.update).toHaveBeenCalledWith(
      'project-1',
      expect.objectContaining({
        configJson: expect.objectContaining({
          runnerImageBuild: expect.objectContaining({
            status: 'failed',
            errorMessage: 'docker build failed',
            imageTag: null,
          }),
        }),
      }),
    );
  });
});
