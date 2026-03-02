import { Module } from '@nestjs/common';
import { McpsController } from './mcps.controller';
import { McpsService } from './mcps.service';
import { RelationalMcpPersistenceModule } from './infrastructure/persistence/relational/relational-persistence.module';
import { ProjectsModule } from '../projects/projects.module';

@Module({
  imports: [RelationalMcpPersistenceModule, ProjectsModule],
  controllers: [McpsController],
  providers: [McpsService],
  exports: [McpsService, RelationalMcpPersistenceModule],
})
export class McpsModule {}
