import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { WorkflowTemplatesService } from './workflow-templates.service';
import { WorkflowTemplateScope } from './dto/workflow-template-scope.enum';
import { WorkflowNodeType } from './dto/workflow-node-type.enum';

const createCurrentUser = () => ({
  sub: 'user-1',
  roles: ['admin'],
  iat: 1,
  exp: 9999999999,
});

const createWorkflowNode = (
  overrides: Partial<{
    nodeOrder: number;
    name: string;
    type: WorkflowNodeType;
    requiresApproval: boolean;
    requiresArtifact: boolean;
  }> = {},
) => ({
  nodeOrder: overrides.nodeOrder ?? 1,
  name: overrides.name ?? 'Analyze',
  type: overrides.type ?? WorkflowNodeType.agent,
  ...(overrides.requiresApproval !== undefined
    ? { requiresApproval: overrides.requiresApproval }
    : {}),
  ...(overrides.requiresArtifact !== undefined
    ? { requiresArtifact: overrides.requiresArtifact }
    : {}),
});

const createWorkflowTemplatesService = () => {
  const workflowTemplateRepository = {
    create: jest.fn(),
    findById: jest.fn(),
    findByName: jest.fn(),
    findAllWithPagination: jest.fn(),
    update: jest.fn(),
    remove: jest.fn(),
    bulkUpdateBusinessLineIdByProjectId: jest.fn(),
  };
  const project = {
    id: 'project-1',
    businessLineId: 'business-line-1',
    name: 'AINative',
  };
  const projectsService = {
    assertProjectCapability: jest.fn().mockResolvedValue(project),
  };
  const businessLineRepository = {
    findById: jest.fn().mockResolvedValue({
      id: 'business-line-1',
      name: 'Retail',
    }),
  };
  const businessLineMemberRepository = {
    findByBusinessLineIdAndUserId: jest.fn(),
  };
  const businessLineCustomRoleRepository = {
    findById: jest.fn(),
  };

  const service = new WorkflowTemplatesService(
    workflowTemplateRepository as never,
    projectsService as never,
    businessLineRepository as never,
    businessLineMemberRepository as never,
    businessLineCustomRoleRepository as never,
  );

  return {
    service,
    workflowTemplateRepository,
    projectsService,
    project,
  };
};

describe('WorkflowTemplatesService', () => {
  it('should persist businessLineId when creating a project workflow template', async () => {
    const { service, workflowTemplateRepository, projectsService, project } =
      createWorkflowTemplatesService();
    const currentUser = createCurrentUser();

    workflowTemplateRepository.findByName.mockResolvedValue(null);
    workflowTemplateRepository.create.mockResolvedValue({
      id: 'template-1',
      businessLineId: project.businessLineId,
      projectId: 'project-1',
    });
    workflowTemplateRepository.findById.mockResolvedValue({
      id: 'template-1',
      name: 'Project template',
      description: null,
      scope: WorkflowTemplateScope.project,
      businessLineId: project.businessLineId,
      projectId: 'project-1',
      isActive: true,
      nodesJson: [createWorkflowNode()],
      createdBy: currentUser.sub,
      createdAt: new Date(),
      updatedAt: new Date(),
      deletedAt: null,
    });

    const result = await service.create(
      {
        name: 'Project template',
        scope: WorkflowTemplateScope.project,
        projectId: 'project-1',
        nodes: [createWorkflowNode({ requiresApproval: true })],
      },
      currentUser,
    );

    expect(projectsService.assertProjectCapability).toHaveBeenCalledWith(
      'project-1',
      currentUser,
      'project.workflow.read',
    );
    expect(workflowTemplateRepository.findByName).toHaveBeenCalledWith(
      'Project template',
      {
        scope: WorkflowTemplateScope.project,
        projectId: 'project-1',
      },
    );
    expect(workflowTemplateRepository.create).toHaveBeenCalledWith({
      name: 'Project template',
      description: null,
      scope: WorkflowTemplateScope.project,
      businessLineId: project.businessLineId,
      projectId: 'project-1',
      isActive: true,
      nodesJson: [createWorkflowNode({ requiresApproval: true })],
      createdBy: currentUser.sub,
    });
    expect(result.businessLineId).toBe(project.businessLineId);
  });

  it('should preserve requiresApproval when updating workflow template nodes', async () => {
    const { service, workflowTemplateRepository } =
      createWorkflowTemplatesService();
    const currentUser = createCurrentUser();

    workflowTemplateRepository.findById
      .mockResolvedValueOnce({
        id: 'template-1',
        name: 'Project template',
        description: null,
        scope: WorkflowTemplateScope.project,
        businessLineId: 'business-line-1',
        projectId: 'project-1',
        isActive: true,
        nodesJson: [createWorkflowNode()],
        createdBy: currentUser.sub,
        createdAt: new Date(),
        updatedAt: new Date(),
        deletedAt: null,
      })
      .mockResolvedValueOnce({
        id: 'template-1',
        name: 'Project template',
        description: null,
        scope: WorkflowTemplateScope.project,
        businessLineId: 'business-line-1',
        projectId: 'project-1',
        isActive: true,
        nodesJson: [createWorkflowNode({ requiresApproval: true })],
        createdBy: currentUser.sub,
        createdAt: new Date(),
        updatedAt: new Date(),
        deletedAt: null,
      });
    workflowTemplateRepository.update.mockResolvedValue({
      id: 'template-1',
      name: 'Project template',
      description: null,
      scope: WorkflowTemplateScope.project,
      businessLineId: 'business-line-1',
      projectId: 'project-1',
      isActive: true,
      nodesJson: [createWorkflowNode({ requiresApproval: true })],
      createdBy: currentUser.sub,
      createdAt: new Date(),
      updatedAt: new Date(),
      deletedAt: null,
    });

    await service.update(
      'template-1',
      {
        nodes: [createWorkflowNode({ requiresApproval: true })],
      },
      currentUser,
    );

    expect(workflowTemplateRepository.update).toHaveBeenCalledWith(
      'template-1',
      {
        nodesJson: [createWorkflowNode({ requiresApproval: true })],
      },
    );
  });

  it('should preserve requiresArtifact when creating and updating workflow template nodes', async () => {
    const { service, workflowTemplateRepository } =
      createWorkflowTemplatesService();
    const currentUser = createCurrentUser();

    workflowTemplateRepository.findByName.mockResolvedValue(null);
    workflowTemplateRepository.create.mockResolvedValue({
      id: 'template-1',
      businessLineId: 'business-line-1',
      projectId: null,
    });
    workflowTemplateRepository.findById
      .mockResolvedValueOnce({
        id: 'template-1',
        name: 'Artifact template',
        description: null,
        scope: WorkflowTemplateScope.businessLine,
        businessLineId: 'business-line-1',
        projectId: null,
        isActive: true,
        nodesJson: [createWorkflowNode({ requiresArtifact: true })],
        createdBy: currentUser.sub,
        createdAt: new Date(),
        updatedAt: new Date(),
        deletedAt: null,
      })
      .mockResolvedValueOnce({
        id: 'template-1',
        name: 'Artifact template',
        description: null,
        scope: WorkflowTemplateScope.businessLine,
        businessLineId: 'business-line-1',
        projectId: null,
        isActive: true,
        nodesJson: [createWorkflowNode({ requiresArtifact: true })],
        createdBy: currentUser.sub,
        createdAt: new Date(),
        updatedAt: new Date(),
        deletedAt: null,
      });
    workflowTemplateRepository.update.mockResolvedValue({
      id: 'template-1',
      name: 'Artifact template',
      description: null,
      scope: WorkflowTemplateScope.businessLine,
      businessLineId: 'business-line-1',
      projectId: null,
      isActive: true,
      nodesJson: [createWorkflowNode({ requiresArtifact: true })],
      createdBy: currentUser.sub,
      createdAt: new Date(),
      updatedAt: new Date(),
      deletedAt: null,
    });

    await service.create(
      {
        name: 'Artifact template',
        scope: WorkflowTemplateScope.businessLine,
        businessLineId: 'business-line-1',
        nodes: [createWorkflowNode({ requiresArtifact: true })],
      },
      currentUser,
    );

    expect(workflowTemplateRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        nodesJson: [createWorkflowNode({ requiresArtifact: true })],
      }),
    );

    await service.update(
      'template-1',
      {
        nodes: [createWorkflowNode({ requiresArtifact: true })],
      },
      currentUser,
    );

    expect(workflowTemplateRepository.update).toHaveBeenCalledWith(
      'template-1',
      {
        nodesJson: [createWorkflowNode({ requiresArtifact: true })],
      },
    );
  });

  it('should create global workflow template when user is admin', async () => {
    const { service, workflowTemplateRepository } =
      createWorkflowTemplatesService();
    const currentUser = createCurrentUser();

    workflowTemplateRepository.findByName.mockResolvedValue(null);
    workflowTemplateRepository.create.mockResolvedValue({ id: 'g1' });
    workflowTemplateRepository.findById.mockResolvedValue({
      id: 'g1',
      name: 'Global seed',
      description: null,
      scope: WorkflowTemplateScope.global,
      businessLineId: null,
      projectId: null,
      isActive: true,
      nodesJson: [createWorkflowNode()],
      createdBy: currentUser.sub,
      createdAt: new Date(),
      updatedAt: new Date(),
      deletedAt: null,
    });

    await service.create(
      {
        name: 'Global seed',
        scope: WorkflowTemplateScope.global,
        nodes: [createWorkflowNode()],
      },
      currentUser,
    );

    expect(workflowTemplateRepository.findByName).toHaveBeenCalledWith(
      'Global seed',
      {
        scope: WorkflowTemplateScope.global,
      },
    );
    expect(workflowTemplateRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        scope: WorkflowTemplateScope.global,
        businessLineId: null,
        projectId: null,
      }),
    );
  });

  it('should reject global workflow template for non-admin', async () => {
    const { service } = createWorkflowTemplatesService();
    const currentUser = { ...createCurrentUser(), roles: ['user'] };

    await expect(
      service.create(
        {
          name: 'Global seed',
          scope: WorkflowTemplateScope.global,
          nodes: [createWorkflowNode()],
        },
        currentUser,
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('should reject access to global template for non-admin', async () => {
    const { service, workflowTemplateRepository } =
      createWorkflowTemplatesService();
    const currentUser = { ...createCurrentUser(), roles: ['user'] };

    workflowTemplateRepository.findById.mockResolvedValue({
      id: 'g1',
      name: 'Global',
      scope: WorkflowTemplateScope.global,
      businessLineId: null,
      projectId: null,
      isActive: true,
      nodesJson: [],
      createdAt: new Date(),
      updatedAt: new Date(),
      deletedAt: null,
    });

    await expect(service.findById('g1', currentUser)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it('should list global masters for business line with pagination', async () => {
    const { service, workflowTemplateRepository } =
      createWorkflowTemplatesService();
    const currentUser = createCurrentUser();
    const rows = [
      {
        id: 'g1',
        name: 'Platform A',
        description: null,
        scope: WorkflowTemplateScope.global,
        businessLineId: null,
        projectId: null,
        isActive: true,
        nodesJson: [createWorkflowNode()],
        createdBy: 'u1',
        createdAt: new Date(),
        updatedAt: new Date(),
        deletedAt: null,
      },
    ];
    workflowTemplateRepository.findAllWithPagination.mockResolvedValue(rows);

    const result = await service.findGlobalMastersForBusinessLine(
      { businessLineId: 'business-line-1' },
      currentUser,
    );

    expect(result).toEqual(rows);
    expect(
      workflowTemplateRepository.findAllWithPagination,
    ).toHaveBeenCalledWith(
      expect.objectContaining({
        scope: WorkflowTemplateScope.global,
        isActive: true,
        excludeGlobal: false,
        paginationOptions: { page: 1, limit: 10 },
      }),
    );
  });

  it('should copy global template to business line', async () => {
    const { service, workflowTemplateRepository } =
      createWorkflowTemplatesService();
    const currentUser = createCurrentUser();
    const globalTemplate = {
      id: 'g1',
      name: 'From platform',
      description: 'd',
      scope: WorkflowTemplateScope.global,
      businessLineId: null,
      projectId: null,
      isActive: true,
      nodesJson: [createWorkflowNode({ name: 'N1' })],
      createdBy: 'admin',
      createdAt: new Date(),
      updatedAt: new Date(),
      deletedAt: null,
    };
    workflowTemplateRepository.findById
      .mockResolvedValueOnce(globalTemplate)
      .mockResolvedValueOnce({
        ...globalTemplate,
        id: 'bl-copy-1',
        scope: WorkflowTemplateScope.businessLine,
        businessLineId: 'business-line-1',
        projectId: null,
        isActive: true,
        createdBy: currentUser.sub,
      });
    workflowTemplateRepository.findByName.mockResolvedValue(null);
    workflowTemplateRepository.create.mockResolvedValue({ id: 'bl-copy-1' });

    const out = await service.copyGlobalTemplateToBusinessLine(
      'g1',
      'business-line-1',
      currentUser,
    );

    expect(out.id).toBe('bl-copy-1');
    expect(workflowTemplateRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'From platform',
        scope: WorkflowTemplateScope.businessLine,
        businessLineId: 'business-line-1',
        nodesJson: globalTemplate.nodesJson,
        createdBy: currentUser.sub,
      }),
    );
  });

  it('should reject copy when source is not global', async () => {
    const { service, workflowTemplateRepository } =
      createWorkflowTemplatesService();
    const currentUser = createCurrentUser();
    workflowTemplateRepository.findById.mockResolvedValue({
      id: 'b1',
      name: 'BL',
      scope: WorkflowTemplateScope.businessLine,
      businessLineId: 'business-line-1',
      projectId: null,
      isActive: true,
      nodesJson: [],
      createdAt: new Date(),
      updatedAt: new Date(),
      deletedAt: null,
    } as never);

    await expect(
      service.copyGlobalTemplateToBusinessLine(
        'b1',
        'business-line-1',
        currentUser,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('should reject copy when global template is inactive', async () => {
    const { service, workflowTemplateRepository } =
      createWorkflowTemplatesService();
    const currentUser = createCurrentUser();
    workflowTemplateRepository.findById.mockResolvedValue({
      id: 'g1',
      name: 'Off',
      scope: WorkflowTemplateScope.global,
      businessLineId: null,
      projectId: null,
      isActive: false,
      nodesJson: [],
      createdAt: new Date(),
      updatedAt: new Date(),
      deletedAt: null,
    } as never);

    await expect(
      service.copyGlobalTemplateToBusinessLine(
        'g1',
        'business-line-1',
        currentUser,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('should reject copy when name exists on business line', async () => {
    const { service, workflowTemplateRepository } =
      createWorkflowTemplatesService();
    const currentUser = createCurrentUser();
    workflowTemplateRepository.findById.mockResolvedValue({
      id: 'g1',
      name: 'Dup',
      scope: WorkflowTemplateScope.global,
      businessLineId: null,
      projectId: null,
      isActive: true,
      nodesJson: [createWorkflowNode()],
      createdAt: new Date(),
      updatedAt: new Date(),
      deletedAt: null,
    } as never);
    workflowTemplateRepository.findByName.mockResolvedValue({
      id: 'x',
    } as never);

    await expect(
      service.copyGlobalTemplateToBusinessLine(
        'g1',
        'business-line-1',
        currentUser,
      ),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('should reject copy when global id not found', async () => {
    const { service, workflowTemplateRepository } =
      createWorkflowTemplatesService();
    const currentUser = createCurrentUser();
    workflowTemplateRepository.findById.mockResolvedValue(null);

    await expect(
      service.copyGlobalTemplateToBusinessLine(
        'g1',
        'business-line-1',
        currentUser,
      ),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});
