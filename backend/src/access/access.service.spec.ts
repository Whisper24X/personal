import { AccessService } from './access.service';
import { defineMemberRoleCapabilities } from '../utils/member-role-capabilities';

describe('AccessService', () => {
  let service: AccessService;
  let businessLineRepository: { findById: jest.Mock };
  let businessLineMemberRepository: {
    findByBusinessLineIdAndUserId: jest.Mock;
  };
  let businessLineCustomRoleRepository: {
    findById: jest.Mock;
    findByIds: jest.Mock;
  };
  let projectRepository: { findById: jest.Mock };
  let projectMemberRepository: {
    findByProjectIdAndUserId: jest.Mock;
  };
  let projectCustomRoleRepository: {
    findById: jest.Mock;
    findByIds: jest.Mock;
  };

  beforeEach(() => {
    businessLineRepository = {
      findById: jest.fn(),
    };
    businessLineMemberRepository = {
      findByBusinessLineIdAndUserId: jest.fn(),
    };
    businessLineCustomRoleRepository = {
      findById: jest.fn(),
      findByIds: jest.fn(),
    };
    projectRepository = {
      findById: jest.fn(),
    };
    projectMemberRepository = {
      findByProjectIdAndUserId: jest.fn(),
    };
    projectCustomRoleRepository = {
      findById: jest.fn(),
      findByIds: jest.fn(),
    };

    service = new AccessService(
      {
        findById: jest.fn(),
      } as never,
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
