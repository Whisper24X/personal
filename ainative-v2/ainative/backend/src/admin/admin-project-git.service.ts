import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ProjectGitStateRepository } from '../projects/project-git-state.repository';
import { ProjectGitLockService } from '../git/project-git-lock.service';
import { SubtreeSnapshotService } from '../git/subtree-snapshot.service';
import { ProjectRepository } from '../projects/infrastructure/persistence/project.repository';
import {
  GitPhaseRecoveryRequest,
  ProjectGitPhase,
  ProjectRuntimeGitState,
  isSnapshotSyncEnabled,
} from '../git/snapshot-sync.types';

const STALE_THRESHOLD_MS = 30 * 60 * 1000; // 30 minutes

@Injectable()
export class AdminProjectGitService implements OnModuleInit {
  private readonly logger = new Logger(AdminProjectGitService.name);

  constructor(
    private readonly gitStateRepository: ProjectGitStateRepository,
    private readonly gitLockService: ProjectGitLockService,
    private readonly subtreeSnapshotService: SubtreeSnapshotService,
    private readonly projectRepository: ProjectRepository,
  ) {}

  async onModuleInit(): Promise<void> {
    await this.detectStalePhases();
  }

  async executeRecovery(
    projectId: string,
    request: GitPhaseRecoveryRequest,
  ): Promise<{
    success: boolean;
    message: string;
    state: ProjectRuntimeGitState;
  }> {
    return this.gitLockService.withProjectGitLock(projectId, async () => {
      const state = await this.gitStateRepository.getState(projectId);

      this.logger.warn(
        `[${projectId}] Recovery action=${request.action} by operator=${request.operatorId}, currentPhase=${state.gitPhase}`,
      );

      switch (request.action) {
        case 'force_idle': {
          const newState = await this.gitStateRepository.setPhase(
            projectId,
            'idle',
          );
          await this.gitStateRepository.setActiveTask(projectId, undefined);
          await this.gitStateRepository.setLastError(projectId, undefined);
          return {
            success: true,
            message: `Phase forced to idle from '${state.gitPhase}'`,
            state: newState,
          };
        }

        case 'retry_deploy': {
          if (
            state.gitPhase !== 'deploy_pending' &&
            state.gitPhase !== 'stale'
          ) {
            return {
              success: false,
              message: `Cannot retry deploy: current phase is '${state.gitPhase}', expected 'deploy_pending' or 'stale'`,
              state,
            };
          }

          if (!state.deployStatus?.deployCommitSha) {
            return {
              success: false,
              message: 'No deployCommitSha found in deployStatus, cannot retry',
              state,
            };
          }

          if (state.gitPhase === 'stale') {
            await this.gitStateRepository.setPhase(projectId, 'deploy_pending');
          }

          return {
            success: true,
            message:
              'Phase set to deploy_pending, caller should now invoke deploySubtrees',
            state: await this.gitStateRepository.getState(projectId),
          };
        }

        case 'retry_cleanup': {
          if (
            state.gitPhase !== 'cleanup_pending' &&
            state.gitPhase !== 'stale'
          ) {
            return {
              success: false,
              message: `Cannot retry cleanup: current phase is '${state.gitPhase}', expected 'cleanup_pending' or 'stale'`,
              state,
            };
          }

          if (state.gitPhase === 'stale') {
            await this.gitStateRepository.setPhase(
              projectId,
              'cleanup_pending',
            );
          }

          return {
            success: true,
            message:
              'Phase set to cleanup_pending, caller should now invoke untrackAndPushMainRepo',
            state: await this.gitStateRepository.getState(projectId),
          };
        }

        case 'skip_to_cleanup': {
          if (
            state.gitPhase !== 'deploy_pending' &&
            state.gitPhase !== 'stale'
          ) {
            return {
              success: false,
              message: `Cannot skip to cleanup: current phase is '${state.gitPhase}'`,
              state,
            };
          }

          if (state.deployStatus) {
            const updatedSubtrees = state.deployStatus.subtrees.map((s) =>
              s.status === 'pending' || s.status === 'failed'
                ? {
                    ...s,
                    status: 'skipped' as const,
                    skippedReason: 'admin_skip' as 'no_changes',
                  }
                : s,
            );
            await this.gitStateRepository.setDeployStatus(projectId, {
              ...state.deployStatus,
              subtrees: updatedSubtrees,
              updatedAt: new Date().toISOString(),
            });
          }

          await this.gitStateRepository.setPhase(projectId, 'cleanup_pending');
          return {
            success: true,
            message:
              'Skipped remaining deploys, phase set to cleanup_pending. Skipped subtrees will not be auto-compensated.',
            state: await this.gitStateRepository.getState(projectId),
          };
        }

        case 'diagnose': {
          return {
            success: true,
            message: JSON.stringify(state, null, 2),
            state,
          };
        }

        default:
          return {
            success: false,
            message: `Unknown recovery action: ${request.action}`,
            state,
          };
      }
    });
  }

  async diagnose(projectId: string): Promise<{
    state: ProjectRuntimeGitState;
    isStale: boolean;
    staleDurationMs?: number;
    lockPending: number;
  }> {
    const state = await this.gitStateRepository.getState(projectId);
    const lockPending = this.gitLockService.getPendingCount(projectId);
    const { isStale, staleDurationMs } = this.checkStale(state);

    return { state, isStale, staleDurationMs, lockPending };
  }

  // ─── Stale detection (runs on startup) ────────────────────────────────────

  private async detectStalePhases(): Promise<void> {
    this.logger.log('Checking for stale git phases on startup...');

    try {
      const projects =
        await this.projectRepository.findByRepositoryProvisioningStatus(
          'ready' as any,
        );

      let staleCount = 0;
      for (const project of projects) {
        if (!isSnapshotSyncEnabled(project)) continue;

        const state = await this.gitStateRepository.getState(project.id);
        const { isStale } = this.checkStale(state);

        if (isStale) {
          staleCount++;
          this.logger.warn(
            `[${project.id}] Stale phase detected: ${state.gitPhase}, lastOp=${state.lastOperationAt}. Marking as 'stale'.`,
          );
          await this.gitStateRepository.setPhase(project.id, 'stale');
          await this.gitStateRepository.setLastError(
            project.id,
            `Auto-marked stale on service startup (was ${state.gitPhase})`,
          );
        }
      }

      if (staleCount > 0) {
        this.logger.warn(
          `Found ${staleCount} project(s) with stale git phases`,
        );
      } else {
        this.logger.log('No stale git phases found');
      }
    } catch (error) {
      this.logger.error(
        `Failed to check stale phases: ${error instanceof Error ? error.message : error}`,
      );
    }
  }

  private checkStale(state: ProjectRuntimeGitState): {
    isStale: boolean;
    staleDurationMs?: number;
  } {
    const stalePhases: ProjectGitPhase[] = [
      'deploy_pending',
      'cleanup_pending',
      'task_active',
    ];

    if (!stalePhases.includes(state.gitPhase)) {
      return { isStale: false };
    }

    if (!state.lastOperationAt) {
      return { isStale: true, staleDurationMs: undefined };
    }

    const elapsed = Date.now() - new Date(state.lastOperationAt).getTime();
    return {
      isStale: elapsed > STALE_THRESHOLD_MS,
      staleDurationMs: elapsed,
    };
  }
}
