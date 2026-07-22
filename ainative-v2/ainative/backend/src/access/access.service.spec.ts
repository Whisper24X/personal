import { AccessService } from './access.service';
import { defineMemberRoleCapabilities } from '../utils/member-role-capabilities';

describe('AccessService', () => {
  let service: AccessService;
  let usersService: { findById: jest.Mock };
  let businessLineRepository: { findById: jest.Mock };
  let businessLineMemberRepository: {
    findByUserId: jest.Mock;
    findByBusinessLineIdAndUserId: jest.Mock;
  };
  let businessLineCustomRoleRepository: {
    findById: jest.Mock;
    findByIds: jest.Mock;
  };
  let projectRepository: {
    findById: jest.Mock;
    findByBusinessLineId: jest.Mock;
    findByIds: jest.Mock;
  };
  let projectMemberRepository: {
    findByProjectIdAndUserId: jest.Mock;
    findByUserId: jest.Mock;
  };
  let projectCustomRoleRepository: {
    findById: jest.Mock;
    findByIds: jest.Mock;
  };

  beforeEach(() => {
    usersService = {
      findById: jest.fn(),
    };
    businessLineRepository = {
      findById: jest.fn(),
    };
    businessLineMemberRepository = {
      findByUserId: jest.fn(),
      findByBusinessLineIdAndUserId: jest.fn(),
    };
    businessLineCustomRoleRepository = {
      findById: jest.fn(),
      findByIds: jest.fn(),
    };
    projectRepository = {
      findById: jest.fn(),
      findByBusinessLineId: jest.fn(),
      findByIds: jest.fn(),
    };
    projectMemberRepository = {
      findByProjectIdAndUserId: jest.fn(),
      findByUserId: jest.fn(),
    };
    projectCustomRoleRepository = {
      findById: jest.fn(),
      findByIds: jest.fn(),
    };

    service = new AccessService(
      usersService as never,
      businessLineRepository as never,
      businessLineMemberRepository as never,
      businessLineCustomRoleRepository as never,
      projectRepository as never,
      projectMemberRepository as never,
      projectCustomRoleRepository as never,
    );
  });

  it('should reuse inline project role capabilities during capability checks', async () => {
    projectRepository.findById.mockResolvedValue({
      id: 'project-1',
      businessLineId: 'business-line-1',
    });

    const membership = {
      roleId: 'role-1',
    };
    defineMemberRoleCapabilities(membership, ['project.task.read']);
    projectMemberRepository.findByProjectIdAndUserId.mockResolvedValue(
      membership,
    );

    await expect(
      service.assertProjectCapability(
        {
          sub: 'user-1',
          roles: [],
        } as never,
        'project-1',
        'project.task.read',
      ),
    ).resolves.toEqual({
      id: 'project-1',
      businessLineId: 'business-line-1',
    });

    expect(projectCustomRoleRepository.findById).not.toHaveBeenCalled();
  });

  it('should allow project capability checks when the project exists without membership', async () => {
    projectRepository.findById.mockResolvedValue({
      id: 'project-1',
      businessLineId: 'business-line-1',
    });
    projectMemberRepository.findByProjectIdAndUserId.mockResolvedValue(null);

    await expect(
      service.assertProjectCapability(
        {
          sub: 'user-2',
          roles: [],
        } as never,
        'project-1',
        'project.task.read',
      ),
    ).resolves.toEqual({
      id: 'project-1',
      businessLineId: 'business-line-1',
    });
  });

  it('should build project capability maps without loading role records when memberships already contain capabilities', async () => {
    const membership = {
      projectId: 'project-1',
      roleId: 'role-1',
    };
    defineMemberRoleCapabilities(membership, ['project.task.read']);

    const capabilityMap = await service.buildProjectCapabilityMap([
      membership as never,
    ]);

    expect(capabilityMap.get('project-1')).toEqual([
      'project.dashboard.read',
      'project.task.read',
    ]);
    expect(projectCustomRoleRepository.findByIds).not.toHaveBeenCalled();
  });

  it('should expose workspace-managed project access through business line membership', async () => {
    usersService.findById.mockResolvedValue({
      id: 'user-1',
      username: 'tester',
      nickname: 'Tester',
      avatar: null,
    });
    const businessMembership = {
      businessLineId: 'business-line-1',
      roleId: 'member',
      customRoleName: 'member',
    };
    defineMemberRoleCapabilities(businessMembership, ['businessLine.read']);
    businessLineMemberRepository.findByUserId.mockResolvedValue([
      businessMembership,
    ]);
    projectMemberRepository.findByUserId.mockResolvedValue([]);
    businessLineRepository.findById.mockResolvedValue({
      id: 'business-line-1',
    });
    projectRepository.findById.mockResolvedValue({
      id: 'workspace-project-1',
      businessLineId: 'business-line-1',
      configJson: {
        workspaceManaged: true,
      },
    });
    projectRepository.findByBusinessLineId.mockResolvedValue([]);
    projectRepository.findByIds.mockResolvedValue([
      {
        id: 'workspace-project-1',
        businessLineId: 'business-line-1',
      },
    ]);

    const access = await service.getCurrentAccess(
      { sub: 'user-1', roles: [] } as never,
      { projectId: 'workspace-project-1' },
    );

    expect(access.currentContext.projectRole).toBe('viewer');
    expect(access.capabilities).toEqual(
      expect.arrayContaining(['project.dashboard.read', 'project.task.read']),
    );
    expect(access.visibility.visibleProjectIds).toContain(
      'workspace-project-1',
    );
  });

  it('should allow business line updates when membership includes update capability', async () => {
    const businessLine = {
      id: 'business-line-1',
      name: 'Retail',
    };
    businessLineRepository.findById.mockResolvedValue(businessLine);

    const membership = {
      businessLineId: 'business-line-1',
      roleId: 'role-1',
    };
    defineMemberRoleCapabilities(membership, ['businessLine.update']);
    businessLineMemberRepository.findByBusinessLineIdAndUserId.mockResolvedValue(
      membership,
    );

    await expect(
      service.assertBusinessLineCapability(
        {
          sub: 'user-1',
          roles: [],
        } as never,
        'business-line-1',
        'businessLine.update',
      ),
    ).resolves.toEqual(businessLine);
    expect(businessLineCustomRoleRepository.findById).not.toHaveBeenCalled();
  });

  it('should reject business line updates when membership lacks update capability', async () => {
    businessLineRepository.findById.mockResolvedValue({
      id: 'business-line-1',
      name: 'Retail',
    });

    const membership = {
      businessLineId: 'business-line-1',
      roleId: 'role-1',
    };
    defineMemberRoleCapabilities(membership, ['businessLine.read']);
    businessLineMemberRepository.findByBusinessLineIdAndUserId.mockResolvedValue(
      membership,
    );

    await expect(
      service.assertBusinessLineCapability(
        {
          sub: 'user-1',
          roles: [],
        } as never,
        'business-line-1',
        'businessLine.update',
      ),
    ).rejects.toMatchObject({
      status: 403,
    });
  });
});
