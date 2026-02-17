import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { WorkflowTemplateRepository } from '../workflow-template.repository';
import { WorkflowTemplateVersionRepository } from '../workflow-template-version.repository';
import { WorkflowTemplateEntity } from './entities/workflow-template.entity';
import { WorkflowTemplateVersionEntity } from './entities/workflow-template-version.entity';
import { WorkflowTemplateRelationalRepository } from './repositories/workflow-template.repository';
import { WorkflowTemplateVersionRelationalRepository } from './repositories/workflow-template-version.repository';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      WorkflowTemplateEntity,
      WorkflowTemplateVersionEntity,
    ]),
  ],
  providers: [
    {
      provide: WorkflowTemplateRepository,
      useClass: WorkflowTemplateRelationalRepository,
    },
    {
      provide: WorkflowTemplateVersionRepository,
      useClass: WorkflowTemplateVersionRelationalRepository,
    },
  ],
  exports: [WorkflowTemplateRepository, WorkflowTemplateVersionRepository],
})
export class RelationalWorkflowTemplatePersistenceModule {}
