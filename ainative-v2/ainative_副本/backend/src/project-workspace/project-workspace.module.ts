import { Module } from '@nestjs/common';
import { ProjectWorkspacePathsService } from './project-workspace-paths.service';

@Module({
  providers: [ProjectWorkspacePathsService],
  exports: [ProjectWorkspacePathsService],
})
export class ProjectWorkspaceModule {}
