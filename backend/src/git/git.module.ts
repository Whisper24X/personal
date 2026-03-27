import { Module, forwardRef } from '@nestjs/common';
import { GitController } from './git.controller';
import { GitService } from './git.service';
import { ProjectsModule } from '../projects/projects.module';

@Module({
  // ProjectsModule → TasksModule → GoalsModule → GitModule：避免循环加载时 ProjectsModule 为 undefined
  imports: [forwardRef(() => ProjectsModule)],
  controllers: [GitController],
  providers: [GitService],
  exports: [GitService],
})
export class GitModule {}
