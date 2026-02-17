import { Module } from '@nestjs/common';
import { SkillsController } from './skills.controller';
import { SkillsService } from './skills.service';
import { RelationalSkillPersistenceModule } from './infrastructure/persistence/relational/relational-persistence.module';

@Module({
  imports: [RelationalSkillPersistenceModule],
  controllers: [SkillsController],
  providers: [SkillsService],
  exports: [SkillsService, RelationalSkillPersistenceModule],
})
export class SkillsModule {}
