import { Module } from '@nestjs/common';
import { WorkspaceGitLockService } from './workspace-git-lock.service';
import { WorkspaceRepositoryService } from './workspace-repository.service';
import { SubRepoValidationService } from './sub-repo-validation.service';

/**
 * Workspace-Native 核心模块。
 * 提供 ainative-workspace 仓库锁和仓库操作服务。
 */
@Module({
  providers: [
    WorkspaceGitLockService,
    WorkspaceRepositoryService,
    SubRepoValidationService,
  ],
  exports: [
    WorkspaceGitLockService,
    WorkspaceRepositoryService,
    SubRepoValidationService,
  ],
})
export class WorkspaceNativeModule {}
