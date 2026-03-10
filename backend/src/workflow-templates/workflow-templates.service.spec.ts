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
  }> = {},
) => ({
  nodeOrder: overrides.nodeOrder ?? 1,
  name: overrides.name ?? 'Analyze',
  type: overrides.type ?? WorkflowNodeType.agent,
  ...(overrides.requiresApproval !== undefined
    ? { requiresApproval: overrides.requiresApproval }
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
    findById: jest.fn(),
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
      'project.workflow.manage',
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
});
