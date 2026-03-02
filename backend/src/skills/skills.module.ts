import { Module } from '@nestjs/common';
import { SkillsController } from './skills.controller';
import { SkillsService } from './skills.service';
import { RelationalSkillPersistenceModule } from './infrastructure/persistence/relational/relational-persistence.module';
import { ProjectsModule } from '../projects/projects.module';

@Module({
  imports: [RelationalSkillPersistenceModule, ProjectsModule],
  controllers: [SkillsController],
  providers: [SkillsService],
  exports: [SkillsService, RelationalSkillPersistenceModule],
})
export class SkillsModule {}
