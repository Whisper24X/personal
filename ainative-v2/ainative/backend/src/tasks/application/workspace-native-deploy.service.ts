import { Injectable, Logger } from '@nestjs/common';
import { spawn } from 'child_process';
import { Project } from '../../projects/domain/project';
import { ProjectWorkspacePathsService } from '../../project-workspace/project-workspace-paths.service';
import { WorkspaceRepositoryService } from '../../git/workspace-repository.service';
import { Task } from '../domain/task';
import { TaskRepository } from '../infrastructure/persistence/task.repository';
import {
  SubRepoDeployBranch,
  SubRepoDeployPushResult,
  TaskDeployStatus,
} from '../../git/workspace-native.types';
import { SubRepoConfig } from '../../git/sub-repo.types';

export const WORKSPACE_NATIVE_PUSH_DIRTY_MESSAGE =
  '任务工作区存在未提交改动，请先填写提交信息并点击“提交”后再推送。';

export interface WorkspaceNativeDeployResult {
  deployCommitSha: string;
  deployStatus: TaskDeployStatus;
  subRepoDeployBranches: SubRepoDeployBranch[];
}

export interface WorkspaceNativeMergeResult {
  results: {
    prefix: string;
    status: 'success' | 'failed' | 'skipped';
    baseBranch: string;
    remoteBranch: string;
    error?: string;
  }[];
}

export interface WorkspaceNativeBranchPushResult {
  success: boolean;
  message: string;
  deployCommitSha?: string;
  subRepoPushResults: SubRepoDeployPushResult[];
}

@Injectable()
export class WorkspaceNativeDeployService {
  private readonly logger = new Logger(WorkspaceNativeDeployService.name);

  constructor(
    private readonly workspaceRepoService: WorkspaceRepositoryService,
    private readonly projectWorkspacePaths: ProjectWorkspacePathsService,
    private readonly taskRepository: TaskRepository,
  ) {}

  resolveWorktreePath(task: Task, project: Project): string {
    return this.projectWorkspacePaths.resolveTaskWorktreePath(task, project, {
      preferLegacyExistingPath: true,
    });
  }

  private buildGitOperationPayload(args: {
    id: string;
    type: 'push' | 'deploy';
    status: 'running' | 'success' | 'failed' | 'cancelled';
    startedAt: string;
    finishedAt?: string;
    logs: string[];
    message?: string;
  }) {
    return {
      id: args.id,
      type: args.type,
      status: args.status,
      startedAt: args.startedAt,
      ...(args.finishedAt ? { finishedAt: args.finishedAt } : {}),
      logs: args.logs,
      ...(args.message ? { message: args.message } : {}),
    };
  }

  async deploy(
    task: Task,
    project: Project,
    emit?: (event: string, data: Record<string, unknown>) => void,
    options?: {
      targetBranches?: Record<string, string>;
      signal?: AbortSignal;
      skipLock?: boolean;
      mode?: 'push' | 'deploy';
    },
  ): Promise<WorkspaceNativeDeployResult> {
    const taskConfig = (task.configJson ?? {}) as Record<string, unknown>;
    const skipLock = options?.skipLock === true;

    const subReposSnapshot = (taskConfig.subReposSnapshot ??
      []) as SubRepoConfig[];
    const workspaceSnapshot = taskConfig.workspaceSnapshot as
      | { taskBranch: string; snapshotCommitSha: string }
      | undefined;

    if (!workspaceSnapshot?.taskBranch) {
      throw new Error('Task has no workspace snapshot — cannot deploy');
    }

    // Atomic lock acquisition
    const deployOpId = `deploy-${Date.now()}`;
    if (!skipLock) {
      const lockPayload = {
        id: deployOpId,
        type: 'deploy',
        status: 'running',
        startedAt: new Date().toISOString(),
        logs: ['部署已开始，正在后台执行中。'],
      };
      const acquired = await this.taskRepository.acquireGitOperationLock(
        task.id,
        lockPayload,
      );
      if (!acquired) {
        throw new Error('有其他 Git 操作正在执行，请等待完成后再部署');
      }
    }

    const worktreePath = this.projectWorkspacePaths.resolveTaskWorktreePath(
      task,
      project,
      { preferLegacyExistingPath: true },
    );

    const isPush = options?.mode === 'push';
    const actionLabel = isPush ? '推送' : '部署';
    const gitOperationType = isPush ? 'push' : 'deploy';
    const startedAt = new Date().toISOString();

    // Backend guard: reject deploy to protected branches (push to feature is fine)
    if (!isPush) {
      const PROTECTED_BRANCHES = ['master', 'main'];
      const targetBranches = options?.targetBranches ?? {};
      for (const subRepo of subReposSnapshot) {
        const target = targetBranches[subRepo.prefix];
        if (target && PROTECTED_BRANCHES.includes(target)) {
          throw new Error(
            `禁止部署到保护分支: ${subRepo.prefix} → ${target}。请使用 PR 合并到 ${target}。`,
          );
        }
      }
    }

    try {
      emit?.('deploy_step', {
        step: 'prepare_commit',
        message: `准备${actionLabel}...`,
      });

      const deployCommitSha = await this.prepareDeployCommit(
        worktreePath,
        workspaceSnapshot.taskBranch,
        actionLabel,
        emit,
        { allowAutoCommit: !isPush },
      );

      if (subReposSnapshot.length === 0) {
        const deployStatus: TaskDeployStatus = {
          status: 'failed',
          deployCommitSha,
          subRepoPushResults: [],
          updatedAt: new Date().toISOString(),
        };

        await this.taskRepository.update(task.id, {
          configJson: {
            ...((await this.taskRepository.findById(task.id))?.configJson ??
              taskConfig),
            deployStatus,
          },
        });

        throw new Error('No sub-repositories configured — nothing to deploy');
      }

      const pushResults: SubRepoDeployPushResult[] = [];
      const deployBranches: SubRepoDeployBranch[] = [
        ...((taskConfig.subRepoDeployBranches ?? []) as SubRepoDeployBranch[]),
      ];

      const targetBranches = options?.targetBranches ?? {};
      const taskFeatureBranch = workspaceSnapshot.taskBranch.startsWith(
        'feature/',
      )
        ? workspaceSnapshot.taskBranch
        : `feature/${workspaceSnapshot.taskBranch}`;

      emit?.('deploy_step', {
        step: 'push_subrepos',
        message: `并行推送 ${subReposSnapshot.length} 个子仓...`,
      });

      const pushTasks = subReposSnapshot.map((subRepo, idx) => {
        const subRepoTaskBranch = isPush
          ? targetBranches[subRepo.prefix] || taskFeatureBranch
          : targetBranches[subRepo.prefix];

        if (!subRepoTaskBranch) {
          emit?.('deploy_subrepo', {
            prefix: subRepo.prefix,
            status: 'failed',
            error: '未指定目标分支',
          });
          return Promise.resolve({
            subRepo,
            result: {
              success: false as const,
              remoteBranch: '',
              error: '未指定目标分支，无法部署',
              skipped: false,
              pushedCommitSha: undefined,
            },
            subRepoTaskBranch: '',
          });
        }

        emit?.('deploy_step', {
          step: 'push_subrepo',
          prefix: subRepo.prefix,
          message: `推送 ${subRepo.prefix} → ${subRepoTaskBranch} (${idx + 1}/${subReposSnapshot.length})...`,
        });

        const subRepoLog = (text: string) => {
          emit?.('deploy_log', { prefix: subRepo.prefix, text });
        };

        return this.workspaceRepoService
          .deployToSubRepo(
            worktreePath,
            subRepo,
            deployCommitSha,
            subRepoTaskBranch,
            subRepoLog,
          )
          .then((result) => ({ subRepo, result, subRepoTaskBranch }));
      });

      const settled = await Promise.allSettled(pushTasks);

      for (const item of settled) {
        if (item.status === 'rejected') {
          const errMsg =
            item.reason instanceof Error
              ? item.reason.message
              : String(item.reason);
          pushResults.push({
            prefix: 'unknown',
            status: 'failed',
            error: errMsg,
            remoteBranch: '',
          });
          continue;
        }

        const { subRepo, result } = item.value;
        const status = result.skipped
          ? 'skipped'
          : result.success
            ? 'success'
            : 'failed';

        pushResults.push({
          prefix: subRepo.prefix,
          status,
          error: result.error,
          remoteBranch: result.remoteBranch,
        });

        emit?.('deploy_subrepo', {
          prefix: subRepo.prefix,
          status,
          branch: result.remoteBranch,
          error: result.error,
        });

        if (result.success && !result.skipped) {
          const existingIdx = deployBranches.findIndex(
            (b) => b.prefix === subRepo.prefix,
          );
          const branchEntry: SubRepoDeployBranch = {
            prefix: subRepo.prefix,
            url: subRepo.url,
            remoteBranch: result.remoteBranch,
            lastPushedCommitSha: result.pushedCommitSha,
            createdAt:
              existingIdx >= 0
                ? deployBranches[existingIdx].createdAt
                : new Date().toISOString(),
          };

          if (existingIdx >= 0) {
            deployBranches[existingIdx] = branchEntry;
          } else {
            deployBranches.push(branchEntry);
          }
        }
      }

      const wasCancelled = options?.signal?.aborted === true;
      const allSuccess =
        !wasCancelled &&
        pushResults.length > 0 &&
        pushResults.every(
          (r) => r.status === 'success' || r.status === 'skipped',
        );

      const deployStatus: TaskDeployStatus = {
        status: wasCancelled ? 'cancelled' : allSuccess ? 'done' : 'failed',
        deployCommitSha,
        subRepoPushResults: pushResults,
        updatedAt: new Date().toISOString(),
      };

      const latestConfig =
        (await this.taskRepository.findById(task.id))?.configJson ?? taskConfig;

      const deployLogs = pushResults.map(
        (r) =>
          `[${r.prefix}] ${r.status}${r.remoteBranch ? ` → ${r.remoteBranch}` : ''}${r.error ? `: ${r.error}` : ''}`,
      );
      if (wasCancelled) deployLogs.push(`${actionLabel}已取消`);

      const gitOperationUpdate = skipLock
        ? {}
        : {
            gitOperation: this.buildGitOperationPayload({
              id: deployOpId,
              type: gitOperationType,
              status: wasCancelled
                ? 'cancelled'
                : allSuccess
                  ? 'success'
                  : 'failed',
              startedAt:
                (latestConfig as any)?.gitOperation?.startedAt ?? startedAt,
              finishedAt: new Date().toISOString(),
              logs: [`${actionLabel}已开始，正在后台执行中。`, ...deployLogs],
              message: wasCancelled
                ? `${actionLabel}已取消`
                : allSuccess
                  ? `${actionLabel}完成: ${pushResults.length} 个子仓`
                  : `${actionLabel}部分失败`,
            }),
          };

      await this.taskRepository.update(task.id, {
        configJson: {
          ...(latestConfig as Record<string, unknown>),
          deployStatus,
          subRepoDeployBranches: deployBranches,
          ...gitOperationUpdate,
        },
      });

      return {
        deployCommitSha,
        deployStatus,
        subRepoDeployBranches: deployBranches,
      };
    } catch (error) {
      if (!skipLock) {
        // Write failed terminal state instead of clearing
        try {
          const latest = await this.taskRepository.findById(task.id);
          if (latest) {
            await this.taskRepository.update(task.id, {
              configJson: {
                ...((latest.configJson ?? {}) as Record<string, unknown>),
                gitOperation: this.buildGitOperationPayload({
                  id: deployOpId,
                  type: gitOperationType,
                  status: 'failed',
                  startedAt,
                  finishedAt: new Date().toISOString(),
                  logs: [
                    `${actionLabel}已开始，正在后台执行中。`,
                    `[error] ${error instanceof Error ? error.message : 'Unknown error'}`,
                  ],
                  message:
                    error instanceof Error
                      ? error.message
                      : `${actionLabel}失败`,
                }),
              },
            });
          }
        } catch {
          /* best effort */
        }
      }
      throw error;
    }
  }

  async mergeSubRepoBranches(
    task: Task,
    project: Project,
  ): Promise<WorkspaceNativeMergeResult> {
    const taskConfig = (task.configJson ?? {}) as Record<string, unknown>;
    const subReposSnapshot = (taskConfig.subReposSnapshot ??
      []) as SubRepoConfig[];
    const deployBranches = (taskConfig.subRepoDeployBranches ??
      []) as SubRepoDeployBranch[];

    if (subReposSnapshot.length === 0) {
      throw new Error('No sub-repositories configured — nothing to merge');
    }

    const worktreePath = this.projectWorkspacePaths.resolveTaskWorktreePath(
      task,
      project,
      { preferLegacyExistingPath: true },
    );
    const workspaceSnapshot = taskConfig.workspaceSnapshot as
      | { taskBranch?: string }
      | undefined;
    const taskBranch = workspaceSnapshot?.taskBranch ?? task.gitBranch;

    if (!taskBranch) {
      throw new Error('Task has no workspace branch — cannot merge bases');
    }

    const statusResult = await this.mustGit(worktreePath, [
      'status',
      '--porcelain',
    ]);
    if (statusResult.stdout.trim()) {
      throw new Error(
        'Workspace has uncommitted changes — commit and push before merging base branches',
      );
    }

    const branchByPrefix = new Map(
      deployBranches.map((branch) => [branch.prefix, branch.remoteBranch]),
    );

    const results: WorkspaceNativeMergeResult['results'] = [];
    for (const subRepo of subReposSnapshot) {
      const remoteBranch = branchByPrefix.get(subRepo.prefix) || taskBranch;
      const result = await this.workspaceRepoService.mergeSubRepoBranch(
        worktreePath,
        subRepo,
        remoteBranch,
      );

      results.push({
        prefix: subRepo.prefix,
        status: result.skipped
          ? 'skipped'
          : result.success
            ? 'success'
            : 'failed',
        baseBranch: result.baseBranch,
        remoteBranch: result.remoteBranch,
        error: result.error,
      });
    }

    const hasChanges = results.some((r) => r.status === 'success' && !r.error);
    if (hasChanges) {
      await this.mustGit(worktreePath, ['push', 'origin', taskBranch]);
    }

    return { results };
  }

  async pushBranchToSubReposFromRoot(params: {
    repositoryRoot: string;
    branch: string;
    subRepos: SubRepoConfig[];
    requireCleanWorktree?: boolean;
    emit?: (event: string, data: Record<string, unknown>) => void;
  }): Promise<WorkspaceNativeBranchPushResult> {
    const branch = params.branch.trim();
    if (!branch) {
      throw new Error('需求分支名不能为空');
    }
    if (params.subRepos.length === 0) {
      throw new Error('No sub-repositories configured — nothing to push');
    }

    if (params.requireCleanWorktree) {
      const statusResult = await this.mustGit(params.repositoryRoot, [
        'status',
        '--porcelain',
      ]);
      if (statusResult.stdout.trim()) {
        throw new Error(
          `需求分支工作区不干净，请先提交或清理变更后再推送: ${statusResult.stdout.trim()}`,
        );
      }
    }

    params.emit?.('deploy_step', {
      step: 'push_config_repo',
      message: `推送需求分支 → ${branch}...`,
    });
    const pushMainResult = await this.runGit(params.repositoryRoot, [
      'push',
      'origin',
      branch,
    ]);
    if (!pushMainResult.success) {
      const stderr = pushMainResult.stderr.trim() || 'unknown error';
      return {
        success: false,
        message: `需求分支推送失败: ${stderr}`,
        subRepoPushResults: [],
      };
    }
    params.emit?.('deploy_step', {
      step: 'push_config_repo_done',
      message: `需求分支已推送到 origin/${branch}`,
    });

    const headResult = await this.mustGit(params.repositoryRoot, [
      'rev-parse',
      'HEAD',
    ]);
    const deployCommitSha = headResult.stdout.trim();
    const targetBranch = this.normalizeFeatureBranch(branch);

    params.emit?.('deploy_step', {
      step: 'push_subrepos',
      message: `并行推送 ${params.subRepos.length} 个子仓...`,
    });

    const pushTasks = params.subRepos.map((subRepo, idx) => {
      params.emit?.('deploy_step', {
        step: 'push_subrepo',
        prefix: subRepo.prefix,
        message: `推送 ${subRepo.prefix} → ${targetBranch} (${idx + 1}/${params.subRepos.length})...`,
      });

      const subRepoLog = (text: string) => {
        params.emit?.('deploy_log', { prefix: subRepo.prefix, text });
      };

      return this.workspaceRepoService
        .deployToSubRepo(
          params.repositoryRoot,
          subRepo,
          deployCommitSha,
          targetBranch,
          subRepoLog,
        )
        .then((result) => ({ subRepo, result }));
    });

    const settled = await Promise.allSettled(pushTasks);
    const pushResults: SubRepoDeployPushResult[] = [];

    for (const item of settled) {
      if (item.status === 'rejected') {
        const errMsg =
          item.reason instanceof Error
            ? item.reason.message
            : String(item.reason);
        pushResults.push({
          prefix: 'unknown',
          status: 'failed',
          error: errMsg,
          remoteBranch: '',
        });
        continue;
      }

      const { subRepo, result } = item.value;
      const status = result.skipped
        ? 'skipped'
        : result.success
          ? 'success'
          : 'failed';

      pushResults.push({
        prefix: subRepo.prefix,
        status,
        error: result.error,
        remoteBranch: result.remoteBranch,
      });

      params.emit?.('deploy_subrepo', {
        prefix: subRepo.prefix,
        status,
        branch: result.remoteBranch,
        error: result.error,
      });
    }

    const success =
      pushResults.length > 0 &&
      pushResults.every(
        (r) => r.status === 'success' || r.status === 'skipped',
      );
    const resultLines = pushResults.map(
      (r) =>
        `[${r.prefix}] ${r.status}${r.remoteBranch ? ` → ${r.remoteBranch}` : ''}${r.error ? `: ${r.error}` : ''}`,
    );

    return {
      success,
      deployCommitSha,
      subRepoPushResults: pushResults,
      message: [
        `需求分支已推送到 origin/${branch}`,
        ...resultLines,
        success ? `推送完成: ${pushResults.length} 个子仓` : '推送部分失败',
      ].join('\n'),
    };
  }

  /**
   * In deploy mode, stage all non-ignored changes and create a system commit
   * before fan-out. Push mode must not auto-commit user workspace changes.
   * Returns deployCommitSha = HEAD after push.
   */
  private async prepareDeployCommit(
    worktreePath: string,
    taskBranch: string,
    actionLabel: '推送' | '部署',
    emit?: (event: string, data: Record<string, unknown>) => void,
    options?: {
      allowAutoCommit?: boolean;
    },
  ): Promise<string> {
    const statusResult = await this.mustGit(worktreePath, [
      'status',
      '--porcelain',
    ]);

    const lines = statusResult.stdout.trim().split('\n').filter(Boolean);

    if (lines.length > 0) {
      if (options?.allowAutoCommit === false) {
        throw new Error(WORKSPACE_NATIVE_PUSH_DIRTY_MESSAGE);
      }

      await this.mustGit(worktreePath, ['add', '--all']);
      await this.mustGit(worktreePath, [
        '-c',
        'user.name=AINative',
        '-c',
        'user.email=ainative@local',
        'commit',
        '-m',
        `task update before ${actionLabel}`,
      ]);
    }

    emit?.('deploy_step', {
      step: 'push_config_repo',
      message: `推送配置仓 → ${taskBranch}...`,
    });
    await this.mustGit(worktreePath, ['push', 'origin', taskBranch]);
    emit?.('deploy_step', {
      step: 'push_config_repo_done',
      message: `配置仓已推送到 origin/${taskBranch}`,
    });

    const headResult = await this.mustGit(worktreePath, ['rev-parse', 'HEAD']);
    return headResult.stdout.trim();
  }

  private normalizeFeatureBranch(branch: string): string {
    return branch.startsWith('feature/') ? branch : `feature/${branch}`;
  }

  private async mustGit(
    cwd: string,
    args: string[],
  ): Promise<{ stdout: string; stderr: string }> {
    const result = await this.runGit(cwd, args);
    if (!result.success) {
      throw new Error(
        `git ${args[0]} failed (cwd=${cwd}): ${result.stderr.slice(0, 500)}`,
      );
    }
    return result;
  }

  private runGit(
    cwd: string,
    args: string[],
  ): Promise<{ success: boolean; stdout: string; stderr: string }> {
    return new Promise((resolve) => {
      const proc = spawn('git', args, {
        cwd,
        env: process.env,
        stdio: 'pipe',
      });

      let stdout = '';
      let stderr = '';

      proc.stdout?.on('data', (chunk: Buffer) => {
        stdout += chunk.toString('utf-8');
      });
      proc.stderr?.on('data', (chunk: Buffer) => {
        stderr += chunk.toString('utf-8');
      });

      const timeoutRef = setTimeout(() => {
        proc.kill('SIGTERM');
        resolve({ success: false, stdout, stderr: `Timed out. ${stderr}` });
      }, 120_000);

      proc.on('error', (error: Error) => {
        clearTimeout(timeoutRef);
        resolve({ success: false, stdout, stderr: error.message });
      });

      proc.on('close', (code: number | null) => {
        clearTimeout(timeoutRef);
        resolve({
          success: code === 0,
          stdout: stdout.trimEnd(),
          stderr: stderr.trimEnd(),
        });
      });
    });
  }
}
