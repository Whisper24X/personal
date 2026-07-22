import { Module } from '@nestjs/common';
import { AdminProjectGitController } from './admin-project-git.controller';
import { AdminProjectGitService } from './admin-project-git.service';
import { ProjectMigrationService } from './project-migration.service';
import { SnapshotSyncModule } from '../git/snapshot-sync.module';
import { ProjectsModule } from '../projects/projects.module';

@Module({
  imports: [SnapshotSyncModule, ProjectsModule],
  controllers: [AdminProjectGitController],
  providers: [AdminProjectGitService, ProjectMigrationService],
  exports: [ProjectMigrationService],
})
export class AdminModule {}
