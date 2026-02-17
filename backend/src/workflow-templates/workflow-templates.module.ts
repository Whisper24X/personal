import { Module } from '@nestjs/common';
import { WorkflowTemplatesController } from './workflow-templates.controller';
import { WorkflowTemplatesService } from './workflow-templates.service';
import { RelationalWorkflowTemplatePersistenceModule } from './infrastructure/persistence/relational/relational-persistence.module';

@Module({
  imports: [RelationalWorkflowTemplatePersistenceModule],
  controllers: [WorkflowTemplatesController],
  providers: [WorkflowTemplatesService],
  exports: [
    WorkflowTemplatesService,
    RelationalWorkflowTemplatePersistenceModule,
  ],
})
export class WorkflowTemplatesModule {}
