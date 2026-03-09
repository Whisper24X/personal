import { WorkflowTemplatesService } from './workflow-templates.service';
import { WorkflowTemplateScope } from './dto/workflow-template-scope.enum';
import { WorkflowNodeType } from './dto/workflow-node-type.enum';

const createCurrentUser = () => ({
  sub: 'user-1',
  roles: ['admin'],
  iat: 1,
  exp: 9999999999,
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
      nodesJson: [
        {
          nodeOrder: 1,
          name: 'Analyze',
          type: WorkflowNodeType.agent,
        },
      ],
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
        nodes: [
          {
            nodeOrder: 1,
            name: 'Analyze',
            type: WorkflowNodeType.agent,
          },
        ],
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
      nodesJson: [
        {
          nodeOrder: 1,
          name: 'Analyze',
          type: WorkflowNodeType.agent,
        },
      ],
      createdBy: currentUser.sub,
    });
    expect(result.businessLineId).toBe(project.businessLineId);
  });
});
