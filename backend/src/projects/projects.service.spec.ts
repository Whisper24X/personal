import { BadRequestException } from '@nestjs/common';
import { CreateProjectDto } from './dto/create-project.dto';
import { Project } from './domain/project';
import { ProjectsService } from './projects.service';

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
    findByBusinessLineIdAndName: jest.fn(),
    create: jest.fn(),
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

  const service = new ProjectsService(
    projectRepository as never,
    projectMemberRepository as never,
    businessLineRepository as never,
    businessLineMemberRepository as never,
    usersService as never,
  );

  return {
    service,
    projectRepository,
    projectMemberRepository,
    businessLineRepository,
  };
};

describe('ProjectsService', () => {
  it('should validate git url and create project with owner member', async () => {
    const {
      service,
      projectRepository,
      projectMemberRepository,
      businessLineRepository,
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
    const ensureRepoSpy = jest
      .spyOn(serviceAny, 'ensureProjectRepository')
      .mockResolvedValue(undefined);

    const result = await service.create(dto, currentUser);

    expect(result).toEqual(project);
    expect(validateGitSpy).toHaveBeenCalledWith(dto.gitUrl);
    expect(ensureRepoSpy).toHaveBeenCalledWith(project);
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
    jest
      .spyOn(serviceAny, 'ensureProjectRepository')
      .mockRejectedValue(new Error('git fetch failed'));

    await expect(service.create(dto, currentUser)).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(projectRepository.remove).toHaveBeenCalledWith(project.id);
    expect(projectMemberRepository.create).not.toHaveBeenCalled();
  });
});
