import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { NullableType } from '../../../../../utils/types/nullable.type';
import { WorkflowTemplateVersion } from '../../../../domain/workflow-template-version';
import { WorkflowTemplateVersionRepository } from '../../workflow-template-version.repository';
import { WorkflowTemplateVersionEntity } from '../entities/workflow-template-version.entity';
import { WorkflowTemplateVersionMapper } from '../mappers/workflow-template-version.mapper';

@Injectable()
export class WorkflowTemplateVersionRelationalRepository
  implements WorkflowTemplateVersionRepository
{
  constructor(
    @InjectRepository(WorkflowTemplateVersionEntity)
    private readonly workflowTemplateVersionRepository: Repository<WorkflowTemplateVersionEntity>,
  ) {}

  async create(
    data: Omit<WorkflowTemplateVersion, 'id' | 'createdAt'>,
  ): Promise<WorkflowTemplateVersion> {
    const entity = await this.workflowTemplateVersionRepository.save(
      this.workflowTemplateVersionRepository.create({
        templateId: data.templateId,
        version: data.version,
        name: data.name,
        description: data.description,
        mode: data.mode,
        nodesJson: data.nodesJson,
        publishedBy: data.publishedBy,
      }),
    );

    return WorkflowTemplateVersionMapper.toDomain(entity);
  }

  async findLatestByTemplateId(
    templateId: WorkflowTemplateVersion['templateId'],
  ): Promise<NullableType<WorkflowTemplateVersion>> {
    const entity = await this.workflowTemplateVersionRepository.findOne({
      where: {
        templateId,
      },
      order: {
        version: 'DESC',
      },
    });

    return entity ? WorkflowTemplateVersionMapper.toDomain(entity) : null;
  }

  async findByTemplateIdAndVersion(
    templateId: WorkflowTemplateVersion['templateId'],
    version: WorkflowTemplateVersion['version'],
  ): Promise<NullableType<WorkflowTemplateVersion>> {
    const entity = await this.workflowTemplateVersionRepository.findOne({
      where: {
        templateId,
        version,
      },
    });

    return entity ? WorkflowTemplateVersionMapper.toDomain(entity) : null;
  }

  async findByTemplateId(
    templateId: WorkflowTemplateVersion['templateId'],
  ): Promise<WorkflowTemplateVersion[]> {
    const entities = await this.workflowTemplateVersionRepository.find({
      where: {
        templateId,
      },
      order: {
        version: 'DESC',
      },
    });

    return entities.map((entity) =>
      WorkflowTemplateVersionMapper.toDomain(entity),
    );
  }
}
