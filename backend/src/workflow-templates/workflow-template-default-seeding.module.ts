import { Module } from '@nestjs/common';
import { RelationalWorkflowTemplatePersistenceModule } from './infrastructure/persistence/relational/relational-persistence.module';
import { WorkflowTemplateDefaultSeedingService } from './workflow-template-default-seeding.service';

@Module({
  imports: [RelationalWorkflowTemplatePersistenceModule],
  providers: [WorkflowTemplateDefaultSeedingService],
  exports: [WorkflowTemplateDefaultSeedingService],
})
export class WorkflowTemplateDefaultSeedingModule {}
