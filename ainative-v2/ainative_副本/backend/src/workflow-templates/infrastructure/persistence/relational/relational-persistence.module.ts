import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { WorkflowTemplateRepository } from '../workflow-template.repository';
import { WorkflowTemplateEntity } from './entities/workflow-template.entity';
import { WorkflowTemplateRelationalRepository } from './repositories/workflow-template.repository';

@Module({
  imports: [TypeOrmModule.forFeature([WorkflowTemplateEntity])],
  providers: [
    {
      provide: WorkflowTemplateRepository,
      useClass: WorkflowTemplateRelationalRepository,
    },
  ],
  exports: [WorkflowTemplateRepository],
})
export class RelationalWorkflowTemplatePersistenceModule {}
