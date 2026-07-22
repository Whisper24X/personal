import { Injectable, Logger } from '@nestjs/common';
import { createHash } from 'crypto';
import { mkdir, writeFile } from 'fs/promises';
import path from 'path';
import { Project } from '../../projects/domain/project';
import { ProjectWorkspacePathsService } from '../../project-workspace/project-workspace-paths.service';
import { WorkspaceRepositoryService } from '../../git/workspace-repository.service';
import { BusinessLineRepository } from '../../business-lines/infrastructure/persistence/business-line.repository';
import { BusinessLine } from '../../business-lines/domain/business-line';
import { resolveSubRepoConfigs, SubRepoConfig } from '../../git/sub-repo.types';
import {
  BusinessLineWorkspaceConfig,
  RunnerConfigCacheMeta,
  TaskWorkspaceStage,
  TaskWorkspaceNativeConfig,
  TaskWorkspaceSnapshot,
  TaskRunnerSnapshot,
} from '../../git/workspace-native.types';
import { assessRunnerSnapshotFreshness } from '../../business-lines/runner-snapshot-freshness';

export interface WorkspaceNativeTaskInitResult {
  taskBranch: string;
  gitWorktree: string;
  worktreePath: string;
  baseBranch: string;
  pushDeferred?: boolean;
  configJsonPatch: Partial<TaskWorkspaceNativeConfig>;
}

export type WorkspaceNativeTaskProgress = {
  stage: TaskWorkspaceStage;
  message: string;
};

export type WorkspaceNativeTaskInitOptions = {
  frozenSubRepos?: SubRepoConfig[];
  gitBaseBranchOverride?: string | null;
  deferPush?: boolean;
  onProgress?: (progress: WorkspaceNativeTaskProgress) => Promise<void>;
};

@Injectable()
export class WorkspaceNativeTaskService {
  private readonly logger = new Logger(WorkspaceNativeTaskService.name);

  constructor(
    private readonly workspaceRepoService: WorkspaceRepositoryService,
    private readonly projectWorkspacePaths: ProjectWorkspacePathsService,
    private readonly businessLineRepository: BusinessLineRepository,
  ) {}

  getBaseBranch(): string {
    return this.workspaceRepoService.getBaseBranch();
  }

  /**
   * workspace-native 模式下的任务初始化。
   * 数据源优先级：project.configJson.subRepos > businessLine.configJson.subRepos
   * Runner 配置优先级：project.configJson.containerRuntime.runnerOrchestration > businessLine cache
   */
  async initializeWorkspaceNativeTask(
    project: Project,
    taskBranchSlug: string,
    options: WorkspaceNativeTaskInitOptions = {},
  ): Promise<WorkspaceNativeTaskInitResult> {
    // 数据源：优先 project 的 subRepos，其次 frozenSubRepos 参数，最后 fallback business line
    let businessLine: BusinessLine | null | undefined;
    let subRepos =
      options.frozenSubRepos ?? resolveSubRepoConfigs(project.configJson);

    if (subRepos.length === 0) {
      businessLine = await this.businessLineRepository.findById(
        project.businessLineId,
      );
      if (businessLine) {
        subRepos = resolveSubRepoConfigs(businessLine.configJson);
      }
    }

    if (subRepos.length === 0) {
      throw new Error(
        'Project has no subRepos configured. Cannot create workspace-native task.',
      );
    }

    const repositoryRoot =
      this.projectWorkspacePaths.resolveRepositoryRoot(project);
    const worktreeBaseDir =
      this.projectWorkspacePaths.resolveWorktreeBaseDir(project);
    const taskBranch = `feature/${taskBranchSlug}`;

    const projectRunnerOrchestration = this.readProjectRunnerOrchestration(
      project.configJson as Record<string, unknown>,
    );
    businessLine ??= await this.businessLineRepository.findById(
      project.businessLineId,
    );
    const businessLineRunnerConfig = this.readBusinessLineRunnerConfig(
      businessLine?.configJson,
    );

    let runnerSnapshot: TaskRunnerSnapshot | undefined;

    const effectiveBaseBranch =
      options?.gitBaseBranchOverride?.trim() ||
      project.defaultBranch?.trim() ||
      this.workspaceRepoService.getBaseBranch();
    const fromFunctionalGroupBase = Boolean(
      options?.gitBaseBranchOverride?.trim(),
    );

    const result = await this.workspaceRepoService.createTaskWorktree(
      repositoryRoot,
      worktreeBaseDir,
      taskBranch,
      subRepos,
      {
        baseBranch: effectiveBaseBranch,
        reuseEmbeddedSubtrees: fromFunctionalGroupBase,
        /** Plain workspace-native tasks keep fetch + push; goal materialize uses local group branch only. */
        localMaterializeTaskWorktree: fromFunctionalGroupBase,
        deferPush: options.deferPush,
        onProgress: async (progress) => {
          await options.onProgress?.({
            stage: progress.stage,
            message: progress.message,
          });
        },
        beforeCommit: async (_worktreePath, heads) => {
          runnerSnapshot = this.resolveRunnerSnapshot(
            projectRunnerOrchestration,
            businessLineRunnerConfig,
            subRepos,
            heads,
          );
          if (
            runnerSnapshot.status === 'ready' &&
            runnerSnapshot.configSnapshot
          ) {
            await this.writeRunnerConfig(
              _worktreePath,
              runnerSnapshot.configSnapshot,
            );
          }
        },
      },
    );

    if (!runnerSnapshot) {
      runnerSnapshot = this.resolveRunnerSnapshot(
        projectRunnerOrchestration,
        businessLineRunnerConfig,
        subRepos,
        result.subRepoHeads,
      );
    }

    const workspaceSnapshot: TaskWorkspaceSnapshot = {
      snapshotCommitSha: result.snapshotCommitSha,
      subRepoHeads: result.subRepoHeads,
      taskBranch: result.taskBranch,
    };

    return {
      taskBranch: result.taskBranch,
      gitWorktree: result.taskBranch,
      worktreePath: result.worktreePath,
      baseBranch: effectiveBaseBranch,
      pushDeferred: result.pushDeferred,
      configJsonPatch: {
        subReposSnapshot: subRepos,
        workspaceSnapshot,
        workspaceStage: 'ready',
        workspaceMessage: '本地任务工作区已准备完成',
        workspaceSnapshotStatus: result.pushDeferred ? 'pending' : 'pushed',
        ...(result.pushDeferred
          ? {}
          : { workspaceSnapshotPushedAt: new Date().toISOString() }),
        runner: runnerSnapshot,
      },
    };
  }

  async pushWorkspaceSnapshot(
    project: Project,
    taskBranch: string,
  ): Promise<void> {
    const repositoryRoot =
      this.projectWorkspacePaths.resolveRepositoryRoot(project);
    await this.workspaceRepoService.pushTaskBranch(repositoryRoot, taskBranch);
  }

  async rollbackTaskInitialization(
    project: Project,
    taskBranch: string,
    gitWorktree: string,
  ): Promise<void> {
    const repositoryRoot =
      this.projectWorkspacePaths.resolveRepositoryRoot(project);
    const worktreeBaseDir =
      this.projectWorkspacePaths.resolveWorktreeBaseDir(project);
    const worktreePath = path.join(worktreeBaseDir, gitWorktree);

    await this.workspaceRepoService.removeTaskWorktree(
      repositoryRoot,
      taskBranch,
      worktreePath,
    );
  }

  /** Materialize runner config to both runner entrypoint and legacy backup paths. */
  private async writeRunnerConfig(
    worktreePath: string,
    configSnapshot: Record<string, unknown>,
  ): Promise<void> {
    const content = `${JSON.stringify(configSnapshot, null, 2)}\n`;
    const rootConfigPath = path.join(worktreePath, 'ainative.runner.json');
    await writeFile(rootConfigPath, content, 'utf-8');

    const runnerDir = path.join(worktreePath, '.ainative', 'runner');
    await mkdir(runnerDir, { recursive: true });
    const legacyConfigPath = path.join(runnerDir, 'ainative.runner.json');
    await writeFile(legacyConfigPath, content, 'utf-8');
    this.logger.debug(`Runner config written to ${rootConfigPath}`);
  }

  private resolveRunnerSnapshot(
    projectRunnerOrchestration: Record<string, unknown> | null,
    businessLineRunnerConfig: BusinessLineRunnerConfigSnapshot | null,
    subRepos: SubRepoConfig[],
    subRepoHeads: Record<string, string>,
  ): TaskRunnerSnapshot {
    const currentFingerprint = this.computeRunnerFingerprint(
      subRepos,
      subRepoHeads,
    );

    const projectSnapshot = this.readProjectRunnerSnapshot(
      projectRunnerOrchestration,
      subRepos,
    );
    if (projectSnapshot) {
      return {
        fingerprint: currentFingerprint,
        status: 'ready',
        configSnapshot: projectSnapshot,
        source: 'projectConfig',
        generatedAt: new Date().toISOString(),
      };
    }

    if (businessLineRunnerConfig?.orchestration) {
      const businessLineSnapshot = this.readBusinessLineRunnerSnapshot(
        businessLineRunnerConfig,
        subRepos,
      );
      if (businessLineSnapshot) {
        return {
          fingerprint: currentFingerprint,
          status: 'ready',
          configSnapshot: businessLineSnapshot,
          source: 'businessLineCache',
          generatedAt:
            businessLineRunnerConfig.meta?.generatedAt ??
            new Date().toISOString(),
        };
      }

      return {
        fingerprint: currentFingerprint,
        status: 'unavailable',
        source: 'unavailableStaleCache',
        error:
          this.describeUnavailableRunnerReason({
            projectRunnerOrchestration,
            businessLineRunnerConfig,
            currentFingerprint,
            subRepos,
          }) ??
          businessLineRunnerConfig.error ??
          'Business line runner cache is stale or not ready. Please regenerate runner configuration.',
      };
    }

    return {
      fingerprint: currentFingerprint,
      status: 'unavailable',
      source: 'unavailableGenerationFailed',
      error:
        this.describeUnavailableRunnerReason({
          projectRunnerOrchestration,
          businessLineRunnerConfig,
          currentFingerprint,
          subRepos,
        }) ??
        'No project runnerOrchestration or business line runnerConfigCache is available. Please regenerate runner configuration.',
    };
  }

  private readProjectRunnerSnapshot(
    projectRunnerOrchestration: Record<string, unknown> | null,
    subRepos: SubRepoConfig[],
  ): Record<string, unknown> | null {
    if (!projectRunnerOrchestration) {
      return null;
    }
    if (!this.hasValidServices(projectRunnerOrchestration)) {
      return null;
    }
    const freshness = assessRunnerSnapshotFreshness({
      runnerOrchestration: projectRunnerOrchestration,
      subRepos,
    });
    if (freshness.reasons.includes('subrepo-fingerprint-mismatch')) {
      return null;
    }
    return projectRunnerOrchestration;
  }

  private readProjectRunnerOrchestration(
    projectConfig: Record<string, unknown>,
  ): Record<string, unknown> | null {
    const containerRuntime = projectConfig.containerRuntime as
      | Record<string, unknown>
      | undefined;
    if (!containerRuntime) return null;
    const orch = containerRuntime.runnerOrchestration as
      | Record<string, unknown>
      | undefined;
    if (!orch) return null;
    return orch;
  }

  private readBusinessLineRunnerConfig(
    configJson: Record<string, unknown> | null | undefined,
  ): BusinessLineRunnerConfigSnapshot | null {
    const config = (configJson ?? {}) as Partial<BusinessLineWorkspaceConfig>;
    const orchestration = this.toObjectRecord(config.runnerConfigCache);
    if (!orchestration || !this.hasValidServices(orchestration)) {
      return null;
    }

    return {
      orchestration,
      status: config.runnerConfigStatus,
      fingerprint:
        typeof config.runnerFingerprint === 'string'
          ? config.runnerFingerprint.trim()
          : undefined,
      meta: this.toObjectRecord(
        config.runnerConfigCacheMeta,
      ) as RunnerConfigCacheMeta | null,
      error:
        typeof config.runnerConfigError === 'string'
          ? config.runnerConfigError
          : undefined,
    };
  }

  private isBusinessLineRunnerCacheUsable(
    snapshot: BusinessLineRunnerConfigSnapshot,
    subRepos: SubRepoConfig[],
  ): boolean {
    if (snapshot.status !== 'ready') {
      return false;
    }
    const freshness = assessRunnerSnapshotFreshness({
      runnerOrchestration: this.withGeneratedMeta(
        snapshot.orchestration,
        snapshot.meta,
      ),
      subRepos,
    });
    return !freshness.reasons.includes('subrepo-fingerprint-mismatch');
  }

  private readBusinessLineRunnerSnapshot(
    snapshot: BusinessLineRunnerConfigSnapshot,
    subRepos: SubRepoConfig[],
  ): Record<string, unknown> | null {
    if (!this.isBusinessLineRunnerCacheUsable(snapshot, subRepos)) {
      return null;
    }
    return this.withGeneratedMeta(snapshot.orchestration, snapshot.meta);
  }

  private describeUnavailableRunnerReason(params: {
    projectRunnerOrchestration: Record<string, unknown> | null;
    businessLineRunnerConfig: BusinessLineRunnerConfigSnapshot | null;
    currentFingerprint: string;
    subRepos: SubRepoConfig[];
  }): string | null {
    const projectReason = this.describeProjectRunnerRejection(
      params.projectRunnerOrchestration,
      params.currentFingerprint,
      params.subRepos,
    );
    if (projectReason) {
      return projectReason;
    }

    const businessLineReason = this.describeBusinessLineRunnerRejection(
      params.businessLineRunnerConfig,
      params.currentFingerprint,
      params.subRepos,
    );
    if (businessLineReason) {
      return businessLineReason;
    }
    return null;
  }

  private describeProjectRunnerRejection(
    orchestration: Record<string, unknown> | null,
    currentFingerprint: string,
    subRepos: SubRepoConfig[],
  ): string | null {
    if (!orchestration) {
      return null;
    }
    if (!this.hasValidServices(orchestration)) {
      return 'Project Runner 配置缺少可用服务，请重置配置。';
    }
    const meta = this.readGeneratedMeta(orchestration);
    const freshness = assessRunnerSnapshotFreshness({
      runnerOrchestration: orchestration,
      subRepos,
    });
    if (
      freshness.reasons.includes('subrepo-fingerprint-mismatch')
    ) {
      return '当前 Runner 配置与子仓结构不匹配，请重置配置后重试。';
    }
    if (freshness.state !== 'usable') {
      if (meta?.verificationStatus && meta.verificationStatus !== 'passed') {
        return 'Runner 配置未通过验证，但仍可用于预览注入；建议重置配置提升成功率。';
      }
      if (meta?.coverageStatus && meta.coverageStatus !== 'valid') {
        return 'Runner 配置覆盖不完整，但仍可用于预览注入；建议重置配置补齐路由。';
      }
    }
    return null;
  }

  private describeBusinessLineRunnerRejection(
    snapshot: BusinessLineRunnerConfigSnapshot | null,
    currentFingerprint: string,
    subRepos: SubRepoConfig[],
  ): string | null {
    if (!snapshot?.orchestration) {
      return null;
    }
    if (snapshot.status !== 'ready') {
      return 'Business line Runner cache 尚未就绪，请重置配置后重试。';
    }
    const freshness = assessRunnerSnapshotFreshness({
      runnerOrchestration: this.withGeneratedMeta(
        snapshot.orchestration,
        snapshot.meta,
      ),
      subRepos,
    });
    if (
      freshness.reasons.includes('subrepo-fingerprint-mismatch')
    ) {
      return 'Business line Runner cache 与当前子仓结构不匹配，请重置配置后重试。';
    }
    if (freshness.state !== 'usable') {
      if (snapshot.meta?.verificationStatus !== 'passed') {
        return 'Business line Runner cache 未通过验证，但仍可用于预览注入；建议重置配置提升成功率。';
      }
      if (snapshot.meta?.coverageStatus !== 'valid') {
        return 'Business line Runner cache 覆盖不完整，但仍可用于预览注入；建议重置配置补齐路由。';
      }
    }
    return null;
  }

  private readGeneratedMeta(
    orchestration: Record<string, unknown>,
  ): RunnerConfigCacheMeta | null {
    return this.toObjectRecord(orchestration.generatedMeta) as
      | RunnerConfigCacheMeta
      | null;
  }

  private withGeneratedMeta(
    orchestration: Record<string, unknown>,
    meta: RunnerConfigCacheMeta | null | undefined,
  ): Record<string, unknown> {
    const existingGeneratedMeta =
      this.toObjectRecord(orchestration.generatedMeta) ?? {};
    const subRepoFingerprint =
      typeof meta?.subRepoFingerprint === 'string'
        ? meta.subRepoFingerprint.trim()
        : '';

    return {
      ...orchestration,
      generatedMeta: {
        ...existingGeneratedMeta,
        ...(meta ?? {}),
        ...(subRepoFingerprint ? { subRepoFingerprint } : {}),
      },
    };
  }

  private hasValidServices(orch: Record<string, unknown>): boolean {
    const services = orch.services;
    return Array.isArray(services) && services.length > 0;
  }

  /**
   * Runner fingerprint = sorted(prefix + normalizedUrl + branch + head) joined → SHA256 前16位
   */
  private computeRunnerFingerprint(
    subRepos: SubRepoConfig[],
    subRepoHeads: Record<string, string>,
  ): string {
    const parts = [...subRepos]
      .sort((a, b) => a.prefix.localeCompare(b.prefix))
      .map((r) => {
        const normalizedUrl = this.normalizeUrl(r.url);
        const head = subRepoHeads[r.prefix] ?? 'unknown';
        return `${r.prefix}|${normalizedUrl}|${r.branch}|${head}`;
      });

    return createHash('sha256')
      .update(parts.join('\n'))
      .digest('hex')
      .slice(0, 16);
  }

  private normalizeUrl(url: string): string {
    return url
      .trim()
      .replace(/\/+$/, '')
      .replace(/^https?:\/\/[^@]+@/, 'https://')
      .toLowerCase();
  }

  private toObjectRecord(value: unknown): Record<string, unknown> | null {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      return null;
    }
    return value as Record<string, unknown>;
  }
}

type BusinessLineRunnerConfigSnapshot = {
  orchestration: Record<string, unknown>;
  status?: string;
  fingerprint?: string;
  meta?: RunnerConfigCacheMeta | null;
  error?: string;
};
