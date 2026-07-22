import { Injectable, Logger } from '@nestjs/common';
import { ProjectRepository } from '../projects/infrastructure/persistence/project.repository';
import { ProjectGitStateRepository } from '../projects/project-git-state.repository';
import { ProjectGitLockService } from '../git/project-git-lock.service';
import { SubtreeSnapshotService } from '../git/subtree-snapshot.service';
import { ProjectRepositoryWorkspaceService } from '../projects/project-repository-workspace.service';
import { isSnapshotSyncEnabled } from '../git/snapshot-sync.types';
import { resolveSubRepoConfigs } from '../git/sub-repo.types';
import { Project } from '../projects/domain/project';
import { rm } from 'fs/promises';
import path from 'path';

export interface MigrationResult {
  projectId: string;
  projectName: string;
  success: boolean;
  error?: string;
  alreadyMigrated?: boolean;
  syncResults?: { prefix: string; synced: boolean; error?: string }[];
}

/**
 * 存量项目迁移服务。
 *
 * 时机：Wave 1 完成后、Wave 2 开始前。
 * 将现有项目从旧的"独立 clone"模式迁移到 snapshot-sync 模式。
 */
@Injectable()
export class ProjectMigrationService {
  private readonly logger = new Logger(ProjectMigrationService.name);

  constructor(
    private readonly projectRepository: ProjectRepository,
    private readonly gitStateRepository: ProjectGitStateRepository,
    private readonly gitLockService: ProjectGitLockService,
    private readonly subtreeSnapshotService: SubtreeSnapshotService,
    private readonly workspaceService: ProjectRepositoryWorkspaceService,
  ) {}

  /**
   * 迁移单个项目到 snapshot-sync 模式。
   *
   * 步骤：
   * 1. 前置检查：无活跃任务
   * 2. 清理旧 sub-repo 独立 .git 目录
   * 3. 执行全量 syncSubtreeSnapshots
   * 4. 初始化 runtimeGitState
   * 5. 设置 subtreeMode: 'snapshot'
   */
  async migrateProject(projectId: string): Promise<MigrationResult> {
    const project = await this.projectRepository.findById(projectId);
    if (!project) {
      return {
        projectId,
        projectName: 'unknown',
        success: false,
        error: 'Project not found',
      };
    }

    if (isSnapshotSyncEnabled(project)) {
      return {
        projectId,
        projectName: project.name,
        success: true,
        alreadyMigrated: true,
      };
    }

    return this.gitLockService.withProjectGitLock(projectId, async () => {
      try {
        const state = await this.gitStateRepository.getState(projectId);
        if (state.activeTaskId) {
          return {
            projectId,
            projectName: project.name,
            success: false,
            error: `Cannot migrate: project has active task ${state.activeTaskId}`,
          };
        }

        await this.gitStateRepository.setPhase(projectId, 'migrating');

        const repositoryRoot =
          this.workspaceService.resolveRepositoryRoot(project);
        const subRepos = resolveSubRepoConfigs(project.configJson);

        if (subRepos.length > 0) {
          await this.cleanupLegacySubRepoGitDirs(repositoryRoot, subRepos);
        }

        let syncResults: MigrationResult['syncResults'];
        if (subRepos.length > 0) {
          const results =
            await this.subtreeSnapshotService.syncSubtreeSnapshots(
              projectId,
              repositoryRoot,
              subRepos,
            );
          syncResults = results;

          const hasError = results.some((r) => r.error);
          if (hasError) {
            await this.gitStateRepository.setPhase(projectId, 'idle');
            return {
              projectId,
              projectName: project.name,
              success: false,
              error: `Sync failed during migration: ${results
                .filter((r) => r.error)
                .map((r) => `${r.prefix}: ${r.error}`)
                .join('; ')}`,
              syncResults,
            };
          }
        }

        const updatedConfigJson: Record<string, unknown> = {
          ...(project.configJson ?? {}),
          subtreeMode: 'snapshot',
        };
        await this.projectRepository.update(projectId, {
          configJson: updatedConfigJson,
        });

        await this.gitStateRepository.transitionPhase(
          projectId,
          'migrating',
          'idle',
        );

        this.logger.log(
          `[${projectId}] Migration completed: ${project.name} → snapshot-sync`,
        );

        return {
          projectId,
          projectName: project.name,
          success: true,
          syncResults,
        };
      } catch (error) {
        const errMsg = error instanceof Error ? error.message : String(error);
        this.logger.error(`[${projectId}] Migration failed: ${errMsg}`);

        try {
          await this.gitStateRepository.setPhase(projectId, 'idle');
          await this.gitStateRepository.setLastError(
            projectId,
            `Migration failed: ${errMsg}`,
          );
        } catch {
          // ignore cleanup errors
        }

        return {
          projectId,
          projectName: project.name,
          success: false,
          error: errMsg,
        };
      }
    });
  }

  /**
   * 批量迁移多个项目。
   */
  async migrateProjects(projectIds: string[]): Promise<MigrationResult[]> {
    const results: MigrationResult[] = [];
    for (const projectId of projectIds) {
      const result = await this.migrateProject(projectId);
      results.push(result);
      this.logger.log(
        `Migration [${results.length}/${projectIds.length}]: ${result.projectName} → ${result.success ? 'OK' : 'FAILED'}${result.alreadyMigrated ? ' (already migrated)' : ''}`,
      );
    }
    return results;
  }

  /**
   * 迁移全部有子仓配置的项目。
   */
  async migrateAll(): Promise<MigrationResult[]> {
    const allProjects = await this.findProjectsWithSubRepos();
    this.logger.log(
      `Found ${allProjects.length} projects with sub-repo configs to migrate`,
    );
    return this.migrateProjects(allProjects.map((p) => p.id));
  }

  // ─── Private ──────────────────────────────────────────────────────────────

  private async findProjectsWithSubRepos(): Promise<Project[]> {
    const projects = await this.projectRepository.findAllWithPagination({
      paginationOptions: { page: 1, limit: 10000 },
    });

    return projects.filter((p) => {
      const subRepos = resolveSubRepoConfigs(p.configJson);
      return subRepos.length > 0 && !isSnapshotSyncEnabled(p);
    });
  }

  /**
   * 清理旧模式下子仓目录中的独立 .git 目录。
   * 旧模式直接 clone 子仓到 prefix/ 目录，会有独立 .git。
   * snapshot-sync 模式不需要这些 .git 目录。
   */
  private async cleanupLegacySubRepoGitDirs(
    repositoryRoot: string,
    subRepos: { prefix: string }[],
  ): Promise<void> {
    for (const sub of subRepos) {
      const subGitDir = path.join(repositoryRoot, sub.prefix, '.git');
      try {
        await rm(subGitDir, { recursive: true, force: true });
        this.logger.debug(`Cleaned up legacy .git dir: ${subGitDir}`);
      } catch {
        // .git dir may not exist, that's fine
      }
    }
  }
}
