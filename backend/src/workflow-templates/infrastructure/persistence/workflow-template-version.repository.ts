import { NullableType } from '../../../utils/types/nullable.type';
import { WorkflowTemplateVersion } from '../../domain/workflow-template-version';

export abstract class WorkflowTemplateVersionRepository {
  abstract create(
    data: Omit<WorkflowTemplateVersion, 'id' | 'createdAt'>,
  ): Promise<WorkflowTemplateVersion>;

  abstract findLatestByTemplateId(
    templateId: WorkflowTemplateVersion['templateId'],
  ): Promise<NullableType<WorkflowTemplateVersion>>;

  abstract findByTemplateIdAndVersion(
    templateId: WorkflowTemplateVersion['templateId'],
    version: WorkflowTemplateVersion['version'],
  ): Promise<NullableType<WorkflowTemplateVersion>>;

  abstract findByTemplateId(
    templateId: WorkflowTemplateVersion['templateId'],
  ): Promise<WorkflowTemplateVersion[]>;
}
