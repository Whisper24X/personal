import { Module } from '@nestjs/common';
import { ProjectGitLockService } from './project-git-lock.service';
import { SubtreeSnapshotService } from './subtree-snapshot.service';
import { ProjectGitStateRepository } from '../projects/project-git-state.repository';
import { RelationalProjectPersistenceModule } from '../projects/infrastructure/persistence/relational/relational-persistence.module';

/**
 * Snapshot-Sync 核心模块。
 * 提供 Git 串行锁、快照同步服务、Git 状态仓储。
 */
@Module({
  imports: [RelationalProjectPersistenceModule],
  providers: [
    ProjectGitLockService,
    SubtreeSnapshotService,
    ProjectGitStateRepository,
  ],
  exports: [
    ProjectGitLockService,
    SubtreeSnapshotService,
    ProjectGitStateRepository,
  ],
})
export class SnapshotSyncModule {}
