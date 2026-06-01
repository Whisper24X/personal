import { Module } from '@nestjs/common';
import { ProjectsModule } from '../projects/projects.module';
import { ProjectContextController } from './project-context.controller';
import { ProjectContextService } from './project-context.service';

@Module({
  imports: [ProjectsModule],
  controllers: [ProjectContextController],
  providers: [ProjectContextService],
  exports: [ProjectContextService],
})
export class ProjectContextModule {}
