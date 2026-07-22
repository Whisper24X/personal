import { Injectable, Logger } from '@nestjs/common';
import { writeFile } from 'fs/promises';
import path from 'path';
import type { RunnerOrchestrationConfig } from '../containers/runner-orchestration.types';
import { ProjectWorkspacePathsService } from '../project-workspace/project-workspace-paths.service';
import { ProjectRepository } from '../projects/infrastructure/persistence/project.repository';

export interface SyncResult {
  synced: boolean;
  skippedReason?: 'manual_orchestration' | 'hidden_project_not_found';
  backupWritten?: boolean;
  warnings?: string[];
}

interface GeneratedMeta {
  source: 'runner-generation';
  generatedAt: string;
  inputFingerprint: string;
  generatorToolId?: string;
  generatorConfigId?: string;
  warningCount: number;
  partial?: boolean;
}

@Injectable()
export class RunnerOrchestrationSyncService {
  private readonly logger = new Logger(RunnerOrchestrationSyncService.name);

  constructor(
    private readonly projectRepository: ProjectRepository,
    private readonly projectWorkspacePaths: ProjectWorkspacePathsService,
  ) {}

  async syncToHiddenProject(
    businessLineId: string,
    orchestration: RunnerOrchestrationConfig,
    options: {
      fingerprint: string;
      generatorToolId?: string;
      generatorConfigId?: string;
      warningCount?: number;
      partial?: boolean;
    },
  ): Promise<SyncResult> {
    const warnings: string[] = [];

    const project =
      await this.projectRepository.findWorkspaceManagedByBusinessLineId(
        businessLineId,
      );

    if (!project) {
      this.logger.debug(
        `No hidden project found for BusinessLine ${businessLineId}`,
      );
      return {
        synced: false,
        skippedReason: 'hidden_project_not_found',
        warnings: ['Hidden project not found'],
      };
    }

    const configJson = (project.configJson ?? {}) as Record<string, unknown>;
    const containerRuntime = (configJson.containerRuntime ?? {}) as Record<
      string,
      unknown
    >;
    const existing = containerRuntime.runnerOrchestration as
      | (Record<string, unknown> & { generatedMeta?: GeneratedMeta })
      | undefined;

    if (!this.canOverwrite(existing)) {
      this.logger.warn(
        `Skipping sync for project ${project.id}: manual orchestration detected`,
      );
      return {
        synced: false,
        skippedReason: 'manual_orchestration',
        warnings: [
          'Hidden project has manual orchestration configuration, auto-sync skipped',
        ],
      };
    }

    const generatedMeta: GeneratedMeta = {
      source: 'runner-generation',
      generatedAt: new Date().toISOString(),
      inputFingerprint: options.fingerprint,
      generatorToolId: options.generatorToolId,
      generatorConfigId: options.generatorConfigId,
      warningCount: options.warningCount ?? 0,
      ...(options.partial ? { partial: true } : {}),
    };

    const newOrchestration = {
      ...orchestration,
      generatedMeta,
    };

    const updatedContainerRuntime = {
      ...containerRuntime,
      runnerOrchestration: newOrchestration,
    };

    const updatedConfigJson = {
      ...configJson,
      containerRuntime: updatedContainerRuntime,
    };

    await this.projectRepository.update(project.id, {
      configJson: updatedConfigJson,
    });

    this.logger.log(
      `Synced runner orchestration to hidden project ${project.id} (fingerprint: ${options.fingerprint})`,
    );

    // Best-effort: write ainative.runner.json to hidden project local repo root
    const backupWritten = await this.writeBackupFile(
      project,
      orchestration,
      warnings,
    );

    await this.syncToWorkspaceNativeProjects(businessLineId, newOrchestration);

    return { synced: true, backupWritten, warnings };
  }

  private async syncToWorkspaceNativeProjects(
    businessLineId: string,
    orchestration: Record<string, unknown>,
  ): Promise<void> {
    try {
      const projects =
        await this.projectRepository.findByBusinessLineId(businessLineId);

      for (const proj of projects) {
        const cfg = (proj.configJson ?? {}) as Record<string, unknown>;
        if (cfg.subtreeMode !== 'workspace-native') continue;
        if (cfg.workspaceManaged === true) continue;

        const runtime = (cfg.containerRuntime ?? {}) as Record<string, unknown>;
        if (
          runtime.runnerOrchestration &&
          (runtime.runnerOrchestration as Record<string, unknown>)
            .manuallyLocked === true
        ) {
          continue;
        }

        await this.projectRepository.update(proj.id, {
          configJson: {
            ...cfg,
            containerRuntime: {
              ...runtime,
              runnerOrchestration: orchestration,
            },
          },
        });
      }
    } catch (err) {
      this.logger.debug(
        `Failed to sync to workspace-native projects: ${err instanceof Error ? err.message : err}`,
      );
    }
  }

  private async writeBackupFile(
    project: {
      id: string;
      name?: string | null;
      businessLineId?: string | null;
      gitUrl?: string | null;
      configJson?: Record<string, unknown> | null;
    },
    orchestration: RunnerOrchestrationConfig,
    warnings: string[],
  ): Promise<boolean> {
    try {
      const repoRoot = this.projectWorkspacePaths.resolveRepositoryRoot(
        project as Parameters<
          ProjectWorkspacePathsService['resolveRepositoryRoot']
        >[0],
      );

      const backupPath = path.join(repoRoot, 'ainative.runner.json');

      const fileContent: Record<string, unknown> = {
        version: 1,
        orchestration,
        _generatedAt: new Date().toISOString(),
        _note: 'Auto-generated backup. Do not edit manually.',
      };

      await writeFile(
        backupPath,
        JSON.stringify(fileContent, null, 2),
        'utf-8',
      );
      return true;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.debug(`Backup file write skipped: ${msg}`);
      warnings.push(`Backup file write failed: ${msg}`);
      return false;
    }
  }

  private canOverwrite(
    existing:
      | (Record<string, unknown> & { generatedMeta?: GeneratedMeta })
      | undefined,
  ): boolean {
    if (!existing) return true;

    // Only refuse if explicitly marked as manually locked
    if ((existing as Record<string, unknown>).manuallyLocked === true) {
      return false;
    }

    return true;
  }
}
