import { ConflictException, NotFoundException } from '@nestjs/common';
import { AutomationsService } from './automations.service';
import { AutomationStatus } from './domain/automation-status.enum';

const createCurrentUser = () => ({
  sub: 'user-1',
  roles: ['developer'],
  iat: 1,
  exp: 9999999999,
});

const createAutomation = (overrides: Record<string, unknown> = {}) => ({
  id: 'automation-1',
  projectId: 'project-1',
  name: 'Daily queue digest',
  prompt: 'Summarize queue health and notify owners.',
  rrule: 'FREQ=DAILY;BYHOUR=9;BYMINUTE=0',
  cwds: ['/workspace/ainative/backend'],
  status: AutomationStatus.ACTIVE,
  lastRunAt: null,
  nextRunAt: null,
  createdBy: 'user-1',
  createdAt: new Date(),
  updatedAt: new Date(),
  deletedAt: null,
  ...overrides,
});

const createAutomationsService = () => {
  const automationRepository = {
    create: jest.fn(),
    findById: jest.fn(),
    findByName: jest.fn(),
    findAllWithPagination: jest.fn(),
    update: jest.fn(),
    remove: jest.fn(),
  };
  const projectsService = {
    assertProjectCapability: jest.fn(),
  };

  const service = new AutomationsService(
    automationRepository as never,
    projectsService as never,
  );

  return {
    service,
    automationRepository,
    projectsService,
  };
};

describe('AutomationsService', () => {
  it('should create automation within project scope', async () => {
    const { service, automationRepository, projectsService } =
      createAutomationsService();
    const currentUser = createCurrentUser();
    const createdAutomation = createAutomation();

    projectsService.assertProjectCapability.mockResolvedValue({
      id: 'project-1',
    });
    automationRepository.findByName.mockResolvedValue(null);
    automationRepository.create.mockResolvedValue(createdAutomation);

    const result = await service.create(
      {
        projectId: 'project-1',
        name: 'Daily queue digest',
        prompt: 'Summarize queue health and notify owners.',
        rrule: 'FREQ=DAILY;BYHOUR=9;BYMINUTE=0',
        status: AutomationStatus.ACTIVE,
        cwds: ['/workspace/ainative/backend'],
      },
      currentUser,
    );

    expect(projectsService.assertProjectCapability).toHaveBeenCalledWith(
      'project-1',
      currentUser,
      'project.automation.read',
    );
    expect(automationRepository.findByName).toHaveBeenCalledWith(
      'Daily queue digest',
      'project-1',
    );
    expect(automationRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        projectId: 'project-1',
        createdBy: currentUser.sub,
      }),
    );
    expect(result).toEqual(createdAutomation);
  });

  it('should reject duplicated name in same project', async () => {
    const { service, automationRepository, projectsService } =
      createAutomationsService();
    const currentUser = createCurrentUser();

    projectsService.assertProjectCapability.mockResolvedValue({
      id: 'project-1',
    });
    automationRepository.findByName.mockResolvedValue(createAutomation());

    await expect(
      service.create(
        {
          projectId: 'project-1',
          name: 'Daily queue digest',
          prompt: 'Summarize queue health and notify owners.',
          rrule: 'FREQ=DAILY;BYHOUR=9;BYMINUTE=0',
        },
        currentUser,
      ),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('should filter list by project id', async () => {
    const { service, automationRepository, projectsService } =
      createAutomationsService();
    const currentUser = createCurrentUser();

    projectsService.assertProjectCapability.mockResolvedValue({
      id: 'project-1',
    });
    automationRepository.findAllWithPagination.mockResolvedValue([
      createAutomation(),
    ]);

    const result = await service.findAllWithPagination(
      {
        projectId: 'project-1',
        page: 2,
        limit: 5,
        keyword: 'daily',
        status: AutomationStatus.ACTIVE,
      },
      currentUser,
    );

    expect(projectsService.assertProjectCapability).toHaveBeenCalledWith(
      'project-1',
      currentUser,
      'project.automation.read',
    );
    expect(automationRepository.findAllWithPagination).toHaveBeenCalledWith({
      paginationOptions: {
        page: 2,
        limit: 5,
      },
      projectId: 'project-1',
      keyword: 'daily',
      status: AutomationStatus.ACTIVE,
    });
    expect(result).toHaveLength(1);
  });

  it('should reject update when automation does not exist', async () => {
    const { service, automationRepository } = createAutomationsService();

    automationRepository.findById.mockResolvedValue(null);

    await expect(
      service.update(
        'automation-1',
        {
          name: 'New name',
        },
        createCurrentUser(),
      ),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});
