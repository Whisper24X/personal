import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { BusinessLineRepository } from './infrastructure/persistence/business-line.repository';
import { ProjectRepository } from '../projects/infrastructure/persistence/project.repository';
import { resolveSubRepoConfigs } from '../git/sub-repo.types';
import type { Project } from '../projects/domain/project';
import { RepositoryProvisioningStatus } from '../projects/domain/repository-provisioning-status.enum';
import type { AllConfigType } from '../config/config.type';
import { BusinessLineLifecycleService } from './business-line-lifecycle.service';

export interface MigrationResult {
  businessLineId: string;
  businessLineName: string;
  projectId?: string;
  status: 'migrated' | 'skipped' | 'failed';
  reason?: string;
}

/**
 * Migrates existing `snapshot` mode projects to `workspace-native` mode.
 *
 * For each business line that has a project with `subtreeMode: 'snapshot'`:
 * 1. Copy subRepos from project.configJson to businessLine.configJson
 * 2. Create/update a hidden workspaceManaged project pointing at ainative-workspace
 * 3. Keep the original business project visible; it is not the workspace repo
 *
 * This is an idempotent operation safe to re-run.
 */
@Injectable()
export class WorkspaceNativeMigrationService {
  private readonly logger = new Logger(WorkspaceNativeMigrationService.name);

  constructor(
    private readonly businessLineRepository: BusinessLineRepository,
    private readonly projectRepository: ProjectRepository,
    private readonly configService: ConfigService<AllConfigType>,
    private readonly businessLineLifecycleService: BusinessLineLifecycleService,
  ) {}

  async migrateAllEligible(
    options: { dryRun?: boolean } = {},
  ): Promise<MigrationResult[]> {
    const results: MigrationResult[] = [];
    const allBusinessLines =
      await this.businessLineRepository.findAllWithPagination({
        paginationOptions: { page: 1, limit: 1000 },
      });

    for (const bl of allBusinessLines) {
      const projects = await this.findSnapshotModeProjects(bl.id);

      if (projects.length === 0) {
        results.push({
          businessLineId: bl.id,
          businessLineName: bl.name,
          status: 'skipped',
          reason: 'No snapshot-mode projects',
        });
        continue;
      }

      for (const project of projects) {
        const result = await this.migrateProject(
          bl,
          project,
          options.dryRun ?? false,
        );
        results.push(result);
      }
    }

    return results;
  }

  async migrateSingle(
    businessLineId: string,
    options: { dryRun?: boolean } = {},
  ): Promise<MigrationResult[]> {
    const bl = await this.businessLineRepository.findById(businessLineId);
    if (!bl) {
      return [
        {
          businessLineId,
          businessLineName: '(not found)',
          status: 'failed',
          reason: 'BusinessLine not found',
        },
      ];
    }

    const projects = await this.findSnapshotModeProjects(bl.id);
    if (projects.length === 0) {
      return [
        {
          businessLineId: bl.id,
          businessLineName: bl.name,
          status: 'skipped',
          reason: 'No snapshot-mode projects',
        },
      ];
    }

    const results: MigrationResult[] = [];
    for (const project of projects) {
      results.push(
        await this.migrateProject(bl, project, options.dryRun ?? false),
      );
    }
    return results;
  }

  private async migrateProject(
    bl: {
      id: string;
      name: string;
      configJson?: Record<string, unknown> | null;
    },
    project: Project,
    dryRun: boolean,
  ): Promise<MigrationResult> {
    try {
      const projectConfig = (project.configJson ?? {}) as Record<
        string,
        unknown
      >;

      if (
        projectConfig.subtreeMode === 'workspace-native' &&
        projectConfig.workspaceManaged !== true
      ) {
        return {
          businessLineId: bl.id,
          businessLineName: bl.name,
          projectId: project.id,
          status: 'skipped',
          reason: 'Already workspace-native',
        };
      }

      if (
        projectConfig.subtreeMode !== 'snapshot' &&
        projectConfig.workspaceManaged !== true
      ) {
        return {
          businessLineId: bl.id,
          businessLineName: bl.name,
          projectId: project.id,
          status: 'skipped',
          reason: `Unsupported subtreeMode: ${String(projectConfig.subtreeMode)}`,
        };
      }

      const projectSubRepos = resolveSubRepoConfigs(project.configJson);
      const blConfigJson = { ...(bl.configJson ?? {}) };

      if (projectSubRepos.length > 0) {
        const existingBlSubRepos = resolveSubRepoConfigs(blConfigJson);
        if (existingBlSubRepos.length === 0) {
          blConfigJson.subRepos = projectSubRepos;
        }
      }

      const workspaceGitUrl = this.readWorkspaceGitUrl();
      const workspaceBaseBranch = this.readWorkspaceBaseBranch();
      const workspaceProjectConfig = {
        subtreeMode: 'workspace-native',
        workspaceManaged: true,
        workspaceNativeDisabled: false,
        subRepos: resolveSubRepoConfigs(blConfigJson),
      };

      if (dryRun) {
        this.logger.log(
          `[DRY RUN] Would migrate project ${project.id} (BL: ${bl.name}): snapshot → workspace-native`,
        );
        return {
          businessLineId: bl.id,
          businessLineName: bl.name,
          projectId: project.id,
          status: 'migrated',
          reason: 'dry-run',
        };
      }

      await this.businessLineRepository.update(bl.id, {
        configJson: blConfigJson,
      });

      await this.upsertWorkspaceProject(
        bl,
        workspaceGitUrl,
        workspaceBaseBranch,
        workspaceProjectConfig,
      );
      await this.businessLineLifecycleService.ensureHiddenProjectAccess(bl);

      this.logger.log(
        `Migrated project ${project.id} (BL: ${bl.name}) from snapshot to workspace-native`,
      );

      return {
        businessLineId: bl.id,
        businessLineName: bl.name,
        projectId: project.id,
        status: 'migrated',
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(
        `Migration failed for project ${project.id} (BL: ${bl.name}): ${message}`,
      );
      return {
        businessLineId: bl.id,
        businessLineName: bl.name,
        projectId: project.id,
        status: 'failed',
        reason: message,
      };
    }
  }

  private async findSnapshotModeProjects(
    businessLineId: string,
  ): Promise<Project[]> {
    const projects = await this.projectRepository.findAllWithPagination({
      businessLineId,
      includeWorkspaceManaged: true,
      paginationOptions: { page: 1, limit: 100 },
    });

    return projects.filter((p) => {
      const config = p.configJson as Record<string, unknown> | null | undefined;
      if (!config) return false;
      return (
        config.subtreeMode === 'snapshot' ||
        config.subtreeMode === 'workspace-native'
      );
    });
  }

  private async upsertWorkspaceProject(
    bl: { id: string; name: string },
    workspaceGitUrl: string,
    workspaceBaseBranch: string,
    workspaceProjectConfig: Record<string, unknown>,
  ): Promise<void> {
    const existing =
      await this.projectRepository.findWorkspaceManagedByBusinessLineId(bl.id);

    if (existing) {
      await this.projectRepository.update(existing.id, {
        name: bl.name,
        description: '',
        gitUrl: workspaceGitUrl,
        defaultBranch: workspaceBaseBranch,
        configJson: {
          ...(existing.configJson ?? {}),
          ...workspaceProjectConfig,
        },
        repositoryProvisioningStatus: RepositoryProvisioningStatus.Ready,
        repositoryProvisioningError: null,
        repositoryProvisionedAt: new Date(),
      });
      return;
    }

    await this.projectRepository.create({
      businessLineId: bl.id,
      name: bl.name,
      slug: '_managed',
      description: '',
      gitUrl: workspaceGitUrl,
      defaultBranch: workspaceBaseBranch,
      configJson: workspaceProjectConfig,
      repositoryProvisioningStatus: RepositoryProvisioningStatus.Ready,
      repositoryProvisioningError: null,
      repositoryProvisionedAt: new Date(),
    });
  }

  private readWorkspaceGitUrl(): string {
    const value = this.configService.get('app.workspaceGitUrl', {
      infer: true,
    });
    if (!value) {
      throw new Error('app.workspaceGitUrl is not configured');
    }
    return value;
  }

  private readWorkspaceBaseBranch(): string {
    return (
      this.configService.get('app.workspaceBaseBranch', { infer: true }) ??
      'master'
    );
  }
}
