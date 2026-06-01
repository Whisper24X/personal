import { Module } from '@nestjs/common';
import { GitModule } from '../git/git.module';
import { SkillsController } from './skills.controller';
import { SkillsService } from './skills.service';
import { ProjectsModule } from '../projects/projects.module';

@Module({
  imports: [ProjectsModule, GitModule],
  controllers: [SkillsController],
  providers: [SkillsService],
  exports: [SkillsService],
})
export class SkillsModule {}
