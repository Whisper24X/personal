import { WorkflowTemplateDefaultSeedingService } from './workflow-template-default-seeding.service';
import { BUSINESS_LINE_DEFAULT_WORKFLOW_TEMPLATES } from './business-line-default-workflow-templates.constants';
import { WorkflowTemplateScope } from './dto/workflow-template-scope.enum';

describe('WorkflowTemplateDefaultSeedingService', () => {
  const createService = () => {
    const workflowTemplateRepository = {
      create: jest.fn(),
      findByName: jest.fn(),
      findById: jest.fn(),
      findAllWithPagination: jest.fn(),
      update: jest.fn(),
      remove: jest.fn(),
      bulkUpdateBusinessLineIdByProjectId: jest.fn(),
    };

    const service = new WorkflowTemplateDefaultSeedingService(
      workflowTemplateRepository as never,
    );

    return { service, workflowTemplateRepository };
  };

  it('should create missing default business line workflow templates', async () => {
    const { service, workflowTemplateRepository } = createService();
    workflowTemplateRepository.findByName.mockResolvedValue(null);
    workflowTemplateRepository.create.mockImplementation((data) => ({
      ...data,
      id: 'new-id',
      createdAt: new Date(),
      updatedAt: new Date(),
      deletedAt: null,
    }));

    await service.ensureDefaultBusinessLineWorkflowTemplates('bl-1', 'user-1');

    expect(workflowTemplateRepository.findByName).toHaveBeenCalledTimes(
      BUSINESS_LINE_DEFAULT_WORKFLOW_TEMPLATES.length,
    );
    expect(workflowTemplateRepository.create).toHaveBeenCalledTimes(
      BUSINESS_LINE_DEFAULT_WORKFLOW_TEMPLATES.length,
    );
    expect(workflowTemplateRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        scope: WorkflowTemplateScope.businessLine,
        businessLineId: 'bl-1',
        createdBy: 'user-1',
        name: BUSINESS_LINE_DEFAULT_WORKFLOW_TEMPLATES[0].name,
      }),
    );
  });

  it('should skip templates that already exist', async () => {
    const { service, workflowTemplateRepository } = createService();
    workflowTemplateRepository.findByName.mockResolvedValue({
      id: 'existing',
      name: BUSINESS_LINE_DEFAULT_WORKFLOW_TEMPLATES[0].name,
    });

    await service.ensureDefaultBusinessLineWorkflowTemplates('bl-1', 'user-1');

    expect(workflowTemplateRepository.create).not.toHaveBeenCalled();
  });
});
