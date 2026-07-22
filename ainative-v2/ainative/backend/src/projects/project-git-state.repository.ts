import { Injectable, Logger } from '@nestjs/common';
import { ProjectRepository } from './infrastructure/persistence/project.repository';
import {
  ProjectGitPhase,
  ProjectRuntimeGitState,
  DeployStatus,
  VALID_PHASE_TRANSITIONS,
} from '../git/snapshot-sync.types';

const DEFAULT_GIT_STATE: ProjectRuntimeGitState = {
  gitPhase: 'idle',
};

/**
 * 封装对 project.configJson.runtimeGitState 的读写。
 *
 * 过渡实现：runtimeGitState 嵌套在 configJson 中。
 * 字段增长后应迁移至独立表或独立列。
 * 所有 runtimeGitState 的读写必须通过此 repository，
 * 不允许在外部直接操作 configJson.runtimeGitState。
 */
@Injectable()
export class ProjectGitStateRepository {
  private readonly logger = new Logger(ProjectGitStateRepository.name);

  constructor(private readonly projectRepository: ProjectRepository) {}

  async getState(projectId: string): Promise<ProjectRuntimeGitState> {
    const project = await this.projectRepository.findById(projectId);
    if (!project) {
      throw new Error(`Project ${projectId} not found`);
    }
    return this.extractState(project.configJson);
  }

  async getPhase(projectId: string): Promise<ProjectGitPhase> {
    const state = await this.getState(projectId);
    return state.gitPhase;
  }

  /**
   * 直接设置 phase，不校验流转合法性。仅供管理员恢复操作使用。
   */
  async setPhase(
    projectId: string,
    phase: ProjectGitPhase,
  ): Promise<ProjectRuntimeGitState> {
    return this.updateState(projectId, (state) => {
      state.gitPhase = phase;
      state.lastOperationAt = new Date().toISOString();
      return state;
    });
  }

  /**
   * 校验合法流转后设置 phase。非法流转会抛出异常。
   */
  async transitionPhase(
    projectId: string,
    expectedCurrent: ProjectGitPhase,
    target: ProjectGitPhase,
  ): Promise<ProjectRuntimeGitState> {
    return this.updateState(projectId, (state) => {
      if (state.gitPhase !== expectedCurrent) {
        throw new Error(
          `Phase transition rejected: expected current phase '${expectedCurrent}' but got '${state.gitPhase}' (project: ${projectId})`,
        );
      }

      const allowed = VALID_PHASE_TRANSITIONS[expectedCurrent];
      if (!allowed.includes(target)) {
        throw new Error(
          `Invalid phase transition: '${expectedCurrent}' → '${target}' is not allowed (project: ${projectId}). Valid targets: [${allowed.join(', ')}]`,
        );
      }

      state.gitPhase = target;
      state.lastOperationAt = new Date().toISOString();
      return state;
    });
  }

  async getDeployStatus(projectId: string): Promise<DeployStatus | undefined> {
    const state = await this.getState(projectId);
    return state.deployStatus;
  }

  async setDeployStatus(
    projectId: string,
    deployStatus: DeployStatus,
  ): Promise<ProjectRuntimeGitState> {
    return this.updateState(projectId, (state) => {
      state.deployStatus = deployStatus;
      state.deployStatus.updatedAt = new Date().toISOString();
      state.lastOperationAt = new Date().toISOString();
      return state;
    });
  }

  async setSnapshotEpoch(
    projectId: string,
    epoch: string,
  ): Promise<ProjectRuntimeGitState> {
    return this.updateState(projectId, (state) => {
      state.snapshotEpoch = epoch;
      state.lastOperationAt = new Date().toISOString();
      return state;
    });
  }

  async setActiveTask(
    projectId: string,
    taskId: string | undefined,
  ): Promise<ProjectRuntimeGitState> {
    return this.updateState(projectId, (state) => {
      state.activeTaskId = taskId;
      state.lastOperationAt = new Date().toISOString();
      return state;
    });
  }

  async setLastError(
    projectId: string,
    error: string | undefined,
  ): Promise<ProjectRuntimeGitState> {
    return this.updateState(projectId, (state) => {
      state.lastError = error;
      state.lastOperationAt = new Date().toISOString();
      return state;
    });
  }

  async clearDeployStatus(projectId: string): Promise<ProjectRuntimeGitState> {
    return this.updateState(projectId, (state) => {
      state.deployStatus = undefined;
      state.lastOperationAt = new Date().toISOString();
      return state;
    });
  }

  // ─── Private ──────────────────────────────────────────────────────────────

  private extractState(
    configJson: Record<string, unknown> | null | undefined,
  ): ProjectRuntimeGitState {
    const config = configJson ?? {};
    const raw = config.runtimeGitState;
    if (!raw || typeof raw !== 'object') {
      return { ...DEFAULT_GIT_STATE };
    }
    return raw as ProjectRuntimeGitState;
  }

  private async updateState(
    projectId: string,
    mutator: (state: ProjectRuntimeGitState) => ProjectRuntimeGitState,
  ): Promise<ProjectRuntimeGitState> {
    const project = await this.projectRepository.findById(projectId);
    if (!project) {
      throw new Error(`Project ${projectId} not found`);
    }

    const currentState = this.extractState(project.configJson);
    const nextState = mutator({ ...currentState });

    const updatedConfigJson: Record<string, unknown> = {
      ...(project.configJson ?? {}),
      runtimeGitState: nextState,
    };

    await this.projectRepository.update(projectId, {
      configJson: updatedConfigJson,
    });

    this.logger.debug(
      `[${projectId}] runtimeGitState updated: phase=${nextState.gitPhase}, epoch=${nextState.snapshotEpoch ?? 'none'}`,
    );

    return nextState;
  }
}
