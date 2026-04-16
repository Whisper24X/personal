import { BadRequestException } from '@nestjs/common';
import path from 'path';
import { CreateProjectDto } from './dto/create-project.dto';
import { Project } from './domain/project';
import { ProjectsService } from './projects.service';

process.env.AINATIVE_DATA_ROOT_DIR ??= path.resolve(process.cwd(), 'tmp');

const createCurrentUser = () => ({
  sub: 'user-1',
  roles: ['admin'],
  iat: 1,
  exp: 9999999999,
});

const createProjectDto = (): CreateProjectDto => ({
  businessLineId: 'business-line-1',
  name: 'AINative',
  description: 'test',
  gitUrl: 'git@example.com:group/ainative.git',
  defaultBranch: 'main',
  configJson: {},
});

const createProject = (): Project => ({
  id: 'project-1',
  businessLineId: 'business-line-1',
  name: 'AINative',
  description: 'test',
  gitUrl: 'git@example.com:group/ainative.git',
  defaultBranch: 'main',
  configJson: {},
  createdAt: new Date(),
  updatedAt: new Date(),
  deletedAt: null,
});

const createProjectsService = () => {
  const projectRepository = {
    findById: jest.fn(),
    findByBusinessLineIdAndName: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    remove: jest.fn(),
  };
  const projectMemberRepository = {
    findByProjectIdAndUserId: jest.fn(),
    create: jest.fn(),
  };
  const businessLineRepository = {
    findById: jest.fn(),
  };
  const businessLineMemberRepository = {
    findByBusinessLineIdAndUserId: jest.fn(),
  };
  const usersService = {
    findById: jest.fn(),
  };
  const taskRepository = {
    bulkUpdateBusinessLineIdByProjectId: jest.fn(),
  };
  const projectCustomRoleRepository = {
    findAllByBusinessLineId: jest.fn().mockResolvedValue([]),
    create: jest.fn().mockImplementation((payload) => ({
      id: `role-${payload.name}`,
      ...payload,
    })),
    update: jest.fn(),
    remove: jest.fn(),
  };
  const workflowTemplateRepository = {
    bulkUpdateBusinessLineIdByProjectId: jest.fn(),
  };
  const accessService = {
    assertProjectCapability: jest.fn(),
    assertBusinessLineCapability: jest.fn(),
    hasBusinessLineCapability: jest.fn(),
    hasProjectCapability: jest.fn(),
  };
  const configService = {
    get: jest.fn((key: string) => {
      if (key === 'AINATIVE_DATA_ROOT_DIR') {
        return '/tmp/ainative-data-root';
      }
      if (key === 'GITLAB_USERNAME') {
        return process.env.GITLAB_USERNAME;
      }
      if (key === 'GITLAB_TOKEN') {
        return process.env.GITLAB_TOKEN;
      }
      return undefined;
    }),
  };
  const projectAccessService = {
    assertCanAccessProject: jest.fn(),
    assertCanManageProject: jest.fn(),
    assertProjectCapability: jest.fn(),
  };
  const projectRepositoryWorkspaceService = {
    ensureProjectRepository: jest.fn(),
    ensureProjectRepositoryReady: jest.fn(),
    runWithProjectRepositoryLock: jest.fn(),
    checkoutBranch: jest.fn(),
    syncRunnerConfigBackup: jest.fn(),
  };

  const service = new ProjectsService(
    projectRepository as never,
    projectMemberRepository as never,
    businessLineRepository as never,
    businessLineMemberRepository as never,
    usersService as never,
    taskRepository as never,
    projectCustomRoleRepository as never,
    workflowTemplateRepository as never,
    accessService as never,
    configService as never,
    projectAccessService as never,
    projectRepositoryWorkspaceService as never,
  );

  return {
    service,
    projectRepository,
    projectMemberRepository,
    businessLineRepository,
    businessLineMemberRepository,
    taskRepository,
    projectCustomRoleRepository,
    workflowTemplateRepository,
    accessService,
    projectAccessService,
    projectRepositoryWorkspaceService,
  };
};

describe('ProjectsService', () => {
  const originalGitlabUsername = process.env.GITLAB_USERNAME;
  const originalGitlabToken = process.env.GITLAB_TOKEN;

  afterEach(() => {
    if (originalGitlabUsername === undefined) {
      delete process.env.GITLAB_USERNAME;
    } else {
      process.env.GITLAB_USERNAME = originalGitlabUsername;
    }

    if (originalGitlabToken === undefined) {
      delete process.env.GITLAB_TOKEN;
    } else {
      process.env.GITLAB_TOKEN = originalGitlabToken;
    }
  });

  it('should validate git url and create project with owner member', async () => {
    const {
      service,
      projectRepository,
      projectMemberRepository,
      businessLineRepository,
      projectRepositoryWorkspaceService,
    } = createProjectsService();
    const serviceAny = service as any;
    const dto = createProjectDto();
    const currentUser = createCurrentUser();
    const project = createProject();

    businessLineRepository.findById.mockResolvedValue({
      id: dto.businessLineId,
      name: 'BL',
    });
    projectRepository.findByBusinessLineIdAndName.mockResolvedValue(null);
    projectRepository.create.mockResolvedValue(project);
    projectMemberRepository.findByProjectIdAndUserId.mockResolvedValue(null);
    projectMemberRepository.create.mockResolvedValue({
      id: 'member-1',
      projectId: project.id,
      userId: currentUser.sub,
      role: 'owner',
    });

    const validateGitSpy = jest
      .spyOn(serviceAny, 'validateGitRepositoryAccessible')
      .mockResolvedValue(undefined);
    projectRepositoryWorkspaceService.ensureProjectRepository.mockResolvedValue(
      '/tmp/ainative-project-repo',
    );
    projectRepositoryWorkspaceService.syncRunnerConfigBackup.mockResolvedValue(
      undefined,
    );

    const result = await service.create(dto, currentUser);

    expect(result).toEqual(project);
    expect(validateGitSpy).toHaveBeenCalledWith(dto.gitUrl);
    expect(
      projectRepositoryWorkspaceService.ensureProjectRepository,
    ).toHaveBeenCalledWith(project);
    expect(projectMemberRepository.create).toHaveBeenCalledTimes(1);
  });

  it('should reject create when git url validation fails', async () => {
    const { service, projectRepository, businessLineRepository } =
      createProjectsService();
    const serviceAny = service as any;
    const dto = createProjectDto();
    const currentUser = createCurrentUser();

    businessLineRepository.findById.mockResolvedValue({
      id: dto.businessLineId,
      name: 'BL',
    });
    projectRepository.findByBusinessLineIdAndName.mockResolvedValue(null);

    jest
      .spyOn(serviceAny, 'validateGitRepositoryAccessible')
      .mockRejectedValue(
        new BadRequestException('Git repository is unreachable'),
      );

    await expect(service.create(dto, currentUser)).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(projectRepository.create).not.toHaveBeenCalled();
  });

  it('should rollback project creation when repository sync fails', async () => {
    const {
      service,
      projectRepository,
      projectMemberRepository,
      businessLineRepository,
      projectRepositoryWorkspaceService,
    } = createProjectsService();
    const serviceAny = service as any;
    const dto = createProjectDto();
    const currentUser = createCurrentUser();
    const project = createProject();

    businessLineRepository.findById.mockResolvedValue({
      id: dto.businessLineId,
      name: 'BL',
    });
    projectRepository.findByBusinessLineIdAndName.mockResolvedValue(null);
    projectRepository.create.mockResolvedValue(project);
    projectRepository.remove.mockResolvedValue(undefined);
    projectMemberRepository.findByProjectIdAndUserId.mockResolvedValue(null);

    jest
      .spyOn(serviceAny, 'validateGitRepositoryAccessible')
      .mockResolvedValue(undefined);
    projectRepositoryWorkspaceService.ensureProjectRepository.mockRejectedValue(
      new Error('git fetch failed'),
    );

    await expect(service.create(dto, currentUser)).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(projectRepository.remove).toHaveBeenCalledWith(project.id);
    expect(projectMemberRepository.create).not.toHaveBeenCalled();
  });

  it('should forward explicit repository sync options', async () => {
    const { service, projectRepositoryWorkspaceService } =
      createProjectsService();
    const currentUser = createCurrentUser();
    const project = createProject();

    projectRepositoryWorkspaceService.ensureProjectRepositoryReady.mockResolvedValue(
      {
        project,
        repositoryRoot: '/tmp/ainative-project-repo',
      },
    );

    const result = await service.ensureProjectRepositoryReady(
      project.id,
      currentUser,
      {
        syncRemote: false,
      },
    );

    expect(result).toEqual({
      project,
      repositoryRoot: '/tmp/ainative-project-repo',
    });
    expect(
      projectRepositoryWorkspaceService.ensureProjectRepositoryReady,
    ).toHaveBeenCalledWith(project.id, currentUser, {
      syncRemote: false,
    });
  });

  it('should inspect repository and prioritize master as recommended default branch', async () => {
    const { service, businessLineRepository } = createProjectsService();
    const serviceAny = service as any;
    const currentUser = createCurrentUser();

    businessLineRepository.findById.mockResolvedValue({
      id: 'business-line-1',
      name: 'BL',
    });
    jest.spyOn(serviceAny, 'runCommand').mockResolvedValue({
      success: true,
      stdout: [
        'aaaaaaaa refs/heads/feature-x',
        'bbbbbbbb refs/heads/main',
        'cccccccc refs/heads/master',
      ].join('\n'),
      stderr: '',
    });

    const result = await service.inspectRepository(
      {
        businessLineId: 'business-line-1',
        gitUrl: 'git@gitlab.yc345.tv:frontend/ainative-workspace.git',
      },
      currentUser,
    );

    expect(result).toEqual({
      repoName: 'ainative-workspace',
      branches: ['master', 'main', 'feature-x'],
      recommendedDefaultBranch: 'master',
    });
  });

  it('should inspect gitlab ssh repository via https token auth when configured', async () => {
    process.env.GITLAB_USERNAME = 'oauth2';
    process.env.GITLAB_TOKEN = 'token-value';

    const { service, businessLineRepository } = createProjectsService();
    const serviceAny = service as any;
    const currentUser = createCurrentUser();

    businessLineRepository.findById.mockResolvedValue({
      id: 'business-line-1',
      name: 'BL',
    });
    const runCommandSpy = jest
      .spyOn(serviceAny, 'runCommand')
      .mockResolvedValue({
        success: true,
        stdout: 'aaaaaaaa refs/heads/main',
        stderr: '',
      });

    await service.inspectRepository(
      {
        businessLineId: 'business-line-1',
        gitUrl: 'git@gitlab.yc345.tv:frontend/ainative-workspace.git',
      },
      currentUser,
    );

    expect(runCommandSpy).toHaveBeenCalledWith('git', [
      'ls-remote',
      '--heads',
      '--refs',
      'https://oauth2:token-value@gitlab.yc345.tv/frontend/ainative-workspace.git',
    ]);
  });

  it('should return bad request when repository inspect command fails', async () => {
    const { service, businessLineRepository } = createProjectsService();
    const serviceAny = service as any;
    const currentUser = createCurrentUser();

    businessLineRepository.findById.mockResolvedValue({
      id: 'business-line-1',
      name: 'BL',
    });
    jest.spyOn(serviceAny, 'runCommand').mockResolvedValue({
      success: false,
      stdout: '',
      stderr: 'Permission denied (publickey).',
    });

    await expect(
      service.inspectRepository(
        {
          businessLineId: 'business-line-1',
          gitUrl: 'git@gitlab.yc345.tv:frontend/ainative-workspace.git',
        },
        currentUser,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('should sync task business line snapshot after project business line changes', async () => {
    const {
      service,
      projectRepository,
      taskRepository,
      workflowTemplateRepository,
    } = createProjectsService();
    const serviceAny = service as any;
    const currentUser = createCurrentUser();
    const currentProject = createProject();
    const updatedProject = {
      ...currentProject,
      businessLineId: 'business-line-2',
    };

    jest
      .spyOn(serviceAny, 'ensureCanUpdateProjectItem')
      .mockResolvedValue(currentProject);
    jest
      .spyOn(serviceAny, 'ensureCanManageBusinessLine')
      .mockResolvedValue(undefined);
    projectRepository.findByBusinessLineIdAndName.mockResolvedValue(null);
    projectRepository.update.mockResolvedValue(updatedProject);

    const result = await service.update(
      currentProject.id,
      {
        businessLineId: 'business-line-2',
        name: 'AINative',
      } as never,
      currentUser,
    );

    expect(result).toEqual(updatedProject);
    expect(
      taskRepository.bulkUpdateBusinessLineIdByProjectId,
    ).toHaveBeenCalledWith({
      projectId: currentProject.id,
      businessLineId: 'business-line-2',
    });
    expect(
      workflowTemplateRepository.bulkUpdateBusinessLineIdByProjectId,
    ).toHaveBeenCalledWith({
      projectId: currentProject.id,
      businessLineId: 'business-line-2',
    });
  });

  it('should checkout next default branch before persisting project update', async () => {
    const { service, projectRepository, projectRepositoryWorkspaceService } =
      createProjectsService();
    const serviceAny = service as any;
    const currentUser = createCurrentUser();
    const currentProject = createProject();
    const updatedProject = {
      ...currentProject,
      defaultBranch: 'release',
    };

    jest
      .spyOn(serviceAny, 'ensureCanUpdateProjectItem')
      .mockResolvedValue(currentProject);
    projectRepositoryWorkspaceService.runWithProjectRepositoryLock.mockImplementation(
      async (
        _projectId: string,
        _user: unknown,
        _options: unknown,
        operation: (ctx: { repositoryRoot: string }) => Promise<Project>,
      ) => operation({ repositoryRoot: '/tmp/project-repo' }),
    );
    projectRepository.update.mockResolvedValue(updatedProject);

    const result = await service.update(
      currentProject.id,
      {
        defaultBranch: 'release',
      } as never,
      currentUser,
    );

    expect(result).toEqual(updatedProject);
    expect(
      projectRepositoryWorkspaceService.runWithProjectRepositoryLock,
    ).toHaveBeenCalledWith(
      currentProject.id,
      currentUser,
      { syncRemote: true },
      expect.any(Function),
    );
    expect(
      projectRepositoryWorkspaceService.checkoutBranch,
    ).toHaveBeenCalledWith('/tmp/project-repo', 'release');
    expect(projectRepository.update).toHaveBeenCalledWith(currentProject.id, {
      defaultBranch: 'release',
    });
    expect(
      projectRepositoryWorkspaceService.syncRunnerConfigBackup,
    ).toHaveBeenCalledWith(updatedProject, '/tmp/project-repo');
  });

  it('should not persist default branch when checkout fails', async () => {
    const { service, projectRepository, projectRepositoryWorkspaceService } =
      createProjectsService();
    const serviceAny = service as any;
    const currentUser = createCurrentUser();
    const currentProject = createProject();
    const checkoutError = new BadRequestException('检出 release 失败');

    jest
      .spyOn(serviceAny, 'ensureCanUpdateProjectItem')
      .mockResolvedValue(currentProject);
    projectRepositoryWorkspaceService.runWithProjectRepositoryLock.mockImplementation(
      async (
        _projectId: string,
        _user: unknown,
        _options: unknown,
        operation: (ctx: { repositoryRoot: string }) => Promise<Project>,
      ) => operation({ repositoryRoot: '/tmp/project-repo' }),
    );
    projectRepositoryWorkspaceService.checkoutBranch.mockRejectedValue(
      checkoutError,
    );

    await expect(
      service.update(
        currentProject.id,
        {
          defaultBranch: 'release',
        } as never,
        currentUser,
      ),
    ).rejects.toThrow(checkoutError);

    expect(projectRepository.update).not.toHaveBeenCalled();
    expect(
      projectRepositoryWorkspaceService.syncRunnerConfigBackup,
    ).not.toHaveBeenCalled();
  });

  it('should rollback repository branch when persistence fails after checkout', async () => {
    const { service, projectRepository, projectRepositoryWorkspaceService } =
      createProjectsService();
    const serviceAny = service as any;
    const currentUser = createCurrentUser();
    const currentProject = createProject();
    const persistenceError = new Error('db unavailable');

    jest
      .spyOn(serviceAny, 'ensureCanUpdateProjectItem')
      .mockResolvedValue(currentProject);
    projectRepositoryWorkspaceService.runWithProjectRepositoryLock.mockImplementation(
      async (
        _projectId: string,
        _user: unknown,
        _options: unknown,
        operation: (ctx: { repositoryRoot: string }) => Promise<Project>,
      ) => operation({ repositoryRoot: '/tmp/project-repo' }),
    );
    projectRepositoryWorkspaceService.checkoutBranch.mockResolvedValue(
      undefined,
    );
    projectRepository.update.mockRejectedValue(persistenceError);

    await expect(
      service.update(
        currentProject.id,
        {
          defaultBranch: 'release',
        } as never,
        currentUser,
      ),
    ).rejects.toThrow(persistenceError);

    expect(
      projectRepositoryWorkspaceService.checkoutBranch,
    ).toHaveBeenNthCalledWith(1, '/tmp/project-repo', 'release');
    expect(
      projectRepositoryWorkspaceService.checkoutBranch,
    ).toHaveBeenNthCalledWith(2, '/tmp/project-repo', 'main');
  });

  it('should persist only supported project-level container runtime fields', async () => {
    const { service, projectRepository } = createProjectsService();
    const serviceAny = service as any;
    const currentUser = createCurrentUser();
    const currentProject = {
      ...createProject(),
      configJson: {
        runnerTemplate: {
          dockerfileRunner: 'FROM node:20',
        },
        runnerImageBuild: {
          status: 'failed',
          startedAt: '2026-03-27T14:39:51.174Z',
        },
      },
    };
    const nextConfigJson = {
      containerRuntime: {
        sandboxProfile: 'preview-web',
        startTimeoutMs: 90_000,
        resourceLimits: {
          memoryMb: 2048,
          pidsLimit: 256,
        },
        platform: 'linux/arm64',
        env: {
          NODE_ENV: 'development',
        },
        runnerOrchestration: {
          services: [
            {
              name: 'web',
              workdir: 'web',
              command: 'pnpm dev',
            },
          ],
        },
        networkMode: 'bridge',
        exposeHostIp: '192.168.50.8',
        exposeContainerPort: 4173,
      },
      runnerTemplate: {
        dockerfileRunner: 'FROM node:22',
      },
      runnerImageBuild: {
        status: 'building',
        startedAt: '2026-03-27T15:00:00.000Z',
      },
    };
    const updatedProject = {
      ...currentProject,
      configJson: {
        containerRuntime: {
          env: {
            NODE_ENV: 'development',
          },
          runnerOrchestration: {
            services: [
              {
                name: 'web',
                workdir: 'web',
                command: 'pnpm dev',
              },
            ],
          },
        },
      },
    };

    jest
      .spyOn(serviceAny, 'ensureCanUpdateProjectItem')
      .mockResolvedValue(currentProject);
    projectRepository.update.mockResolvedValue(updatedProject);

    const result = await service.update(
      currentProject.id,
      {
        configJson: nextConfigJson,
      } as never,
      currentUser,
    );

    expect(result).toEqual(updatedProject);
    expect(projectRepository.update).toHaveBeenCalledWith(
      currentProject.id,
      expect.objectContaining({
        configJson: updatedProject.configJson,
      }),
    );
  });

  it('should return project detail without injecting runtime preview data', async () => {
    const { service, projectAccessService } = createProjectsService();
    const currentUser = createCurrentUser();
    const project = {
      ...createProject(),
      configJson: {
        preview: {
          url: 'https://preview.example.com/p/task-1/',
        },
      },
    };

    projectAccessService.assertCanAccessProject.mockResolvedValue(project);

    const result = await service.findById(project.id, currentUser);

    expect(result).toEqual(project);
  });
});
