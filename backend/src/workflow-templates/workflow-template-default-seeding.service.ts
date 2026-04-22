import { Injectable } from '@nestjs/common';
import { BUSINESS_LINE_DEFAULT_WORKFLOW_TEMPLATES } from './business-line-default-workflow-templates.constants';
import { WorkflowTemplateScope } from './dto/workflow-template-scope.enum';
import { WorkflowTemplateRepository } from './infrastructure/persistence/workflow-template.repository';
import {
  ensureValidWorkflowTemplateNodes,
  normalizeWorkflowTemplateNodes,
} from './workflow-template-nodes.util';

@Injectable()
export class WorkflowTemplateDefaultSeedingService {
  constructor(
    private readonly workflowTemplateRepository: WorkflowTemplateRepository,
  ) {}

  async ensureDefaultBusinessLineWorkflowTemplates(
    businessLineId: string,
    createdByUserId: string,
  ): Promise<void> {
    for (const template of BUSINESS_LINE_DEFAULT_WORKFLOW_TEMPLATES) {
      ensureValidWorkflowTemplateNodes(template.nodes);

      const existed = await this.workflowTemplateRepository.findByName(
        template.name,
        {
          scope: WorkflowTemplateScope.businessLine,
          businessLineId,
        },
      );

      if (existed) {
        continue;
      }

      const normalizedNodes = normalizeWorkflowTemplateNodes(template.nodes);

      await this.workflowTemplateRepository.create({
        name: template.name,
        description: template.description ?? null,
        scope: WorkflowTemplateScope.businessLine,
        businessLineId,
        projectId: null,
        isActive: true,
        nodesJson: normalizedNodes,
        createdBy: createdByUserId,
      });
    }
  }
}
