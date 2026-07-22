import { Module } from '@nestjs/common';
import { GitController } from './git.controller';
import { GitService } from './git.service';
import { ProjectsModule } from '../projects/projects.module';
import { WorkspaceNativeModule } from './workspace-native.module';
import { RelationalProjectPersistenceModule } from '../projects/infrastructure/persistence/relational/relational-persistence.module';
import { ProjectWorkspaceModule } from '../project-workspace/project-workspace.module';
import { AccessModule } from '../access/access.module';

@Module({
  imports: [
    ProjectsModule,
    WorkspaceNativeModule,
    RelationalProjectPersistenceModule,
    ProjectWorkspaceModule,
    AccessModule,
  ],
  controllers: [GitController],
  providers: [GitService],
  exports: [GitService],
})
export class GitModule {}
