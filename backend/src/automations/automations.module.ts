import { Module } from '@nestjs/common';
import { ProjectsModule } from '../projects/projects.module';
import { AutomationsController } from './automations.controller';
import { AutomationsService } from './automations.service';
import { RelationalAutomationPersistenceModule } from './infrastructure/persistence/relational/relational-persistence.module';

@Module({
  imports: [RelationalAutomationPersistenceModule, ProjectsModule],
  controllers: [AutomationsController],
  providers: [AutomationsService],
  exports: [AutomationsService, RelationalAutomationPersistenceModule],
})
export class AutomationsModule {}
