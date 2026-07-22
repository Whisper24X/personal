import { spawn } from 'child_process';
import { existsSync } from 'fs';
import {
  Injectable,
  Logger,
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtPayloadType } from '../auth/strategies/types/jwt-payload.type';
import { ProjectWorkspacePathsService } from '../project-workspace/project-workspace-paths.service';
import { TaskRepository } from '../tasks/infrastructure/persistence/task.repository';
import { Project } from './domain/project';
import { ProjectAccessService } from './project-access.service';
import { ProjectRepositoryWorkspaceService } from './project-repository-workspace.service';
import { SubtreeSnapshotService } from '../git/subtree-snapshot.service';
import { ProjectGitLockService } from '../git/project-git-lock.service';
import { ProjectGitStateRepository } from './project-git-state.repository';
import {
  isSnapshotSyncEnabled,
  DeployStatus,
} from '../git/snapshot-sync.types';
import { resolveSubRepoConfigs, SubRepoConfig } from '../git/sub-repo.types';

@Injectable()
export class ProjectDeployService {
  private readonly logger = new Logger(ProjectDeployService.name);
  private readonly defaultGitTimeoutMs = 60_000;
  private readonly deployLocks = new Map<string, string>();

  private readonly gitlabHttpAuthHost = 'gitlab.yc345.tv';

  constructor(
    private readonly projectAccessService: ProjectAccessService,
    private readonly projectRepositoryWorkspaceService: ProjectRepositoryWorkspaceService,
    private readonly taskRepository: TaskRepository,
    private readonly projectWorkspacePathsService: ProjectWorkspacePathsService,
    private readonly configService: ConfigService,
    private readonly subtreeSnapshotService: SubtreeSnapshotService,
    private readonly gitLockService: ProjectGitLockService,
    private readonly gitStateRepository: ProjectGitStateRepository,
  ) {}

  async findTaskForProject(projectId: string, taskId: string) {
    const task = await this.taskRepository.findById(taskId);
    if (!task || task.projectId !== projectId) {
      return null;
    }
    return task;
  }

  async getDeployInfo(
    projectId: Project['id'],
    taskId: string,
    currentUser: JwtPayloadType,
  ): Promise<{ featureBranch: string | null }> {
    const project = await this.projectAccessService.assertCanAccessProject(
      projectId,
      currentUser,
    );

    const task = await this.taskRepository.findById(taskId);
    if (!task || task.projectId !== projectId) {
      throw new NotFoundException('Task not found in this project');
    }

    const worktreePath = this.resolveTaskWorktreePathForDeploy(task, project);
    if (!existsSync(worktreePath)) {
      return { featureBranch: null };
    }

    return {
      featureBranch: await this.resolveCurrentBranch(worktreePath),
    };
  }

  async deployToTest(
    projectId: Project['id'],
    taskId: string,
    currentUser: JwtPayloadType,
    emit: (event: string, data: Record<string, unknown>) => void,
    commandOverride?: string,
    signal?: AbortSignal,
  ): Promise<void> {
    const project = await this.projectAccessService.assertCanAccessProject(
      projectId,
      currentUser,
    );
    const deployCommand = commandOverride?.trim() || 'make push-test';
    if (!deployCommand) {
      throw new BadRequestException('Deploy command is empty');
    }

    const task = await this.taskRepository.findById(taskId);
    if (!task || task.projectId !== projectId) {
      throw new NotFoundException('Task not found in this project');
    }

    const worktreePath = this.resolveTaskWorktreePathForDeploy(task, project);
    if (!existsSync(worktreePath)) {
      throw new BadRequestException(
        `Task worktree directory does not exist: ${worktreePath}`,
      );
    }

    const featureBranch = await this.resolveCurrentBranch(worktreePath);
    const mainRepoPath =
      this.projectRepositoryWorkspaceService.resolveRepositoryRoot(project);
    const isDefaultDeploy = deployCommand === 'make push-test';
    const execCwd = isDefaultDeploy ? mainRepoPath : worktreePath;

    const lockKey = isDefaultDeploy ? mainRepoPath : worktreePath;
    const lockedBy = this.deployLocks.get(lockKey);
    if (lockedBy) {
      throw new ConflictException(
        isDefaultDeploy
          ? `该项目有其他分支正在部署中（${lockedBy}），请等待完成后再试`
          : `该任务正在部署中（${lockedBy}），请等待完成后再试`,
      );
    }

    const deployer =
      (currentUser as Record<string, unknown>).name ||
      (currentUser as Record<string, unknown>).email ||
      currentUser.sub;
    this.deployLocks.set(lockKey, String(deployer));

    try {
      const gitName = currentUser.username || 'ainative-user';
      const gitEmail = `${currentUser.username || currentUser.sub}@ainative.local`;

      if (isDefaultDeploy && featureBranch) {
        const status = await this.runCommand('git', [
          '-C',
          worktreePath,
          'status',
          '--porcelain',
        ]);
        if (status.success && status.stdout.trim()) {
          emit('stdout', {
            text: '[pre-deploy] 检测到未提交的改动，自动提交中...\n',
          });
          const addResult = await this.runCommand('git', [
            '-C',
            worktreePath,
            'add',
            '-A',
          ]);
          if (!addResult.success) {
            emit('stdout', { text: `[pre-deploy] git add 失败，部署中止\n` });
            throw new BadRequestException('git add 失败: ' + addResult.stderr);
          }
          const commitResult = await this.runCommand('git', [
            '-C',
            worktreePath,
            '-c',
            `user.name=${gitName}`,
            '-c',
            `user.email=${gitEmail}`,
            'commit',
            '-m',
            `deploy: auto-commit ${featureBranch}`,
          ]);
          if (!commitResult.success) {
            emit('stdout', {
              text: `[pre-deploy] git commit 失败，部署中止\n`,
            });
            throw new BadRequestException(
              'git commit 失败: ' + commitResult.stderr,
            );
          }
          const pushResult = await this.runCommand('git', [
            '-C',
            worktreePath,
            'push',
            'origin',
            featureBranch,
          ]);
          if (!pushResult.success) {
            emit('stdout', {
              text: `[pre-deploy] git push 失败，部署中止\n`,
            });
            throw new BadRequestException(
              'git push 失败: ' + pushResult.stderr,
            );
          }
          emit('stdout', {
            text: '[pre-deploy] 已提交并推送到远程\n',
          });
        }

        const mainBranch = project.defaultBranch || 'main';

        const fetch = await this.runCommand('git', [
          '-C',
          mainRepoPath,
          'fetch',
          '--all',
        ]);
        if (!fetch.success) {
          emit('stdout', { text: '[pre-deploy] git fetch 失败，部署中止\n' });
          throw new BadRequestException('git fetch 失败，请检查网络或仓库配置');
        }

        const checkout = await this.runCommand('git', [
          '-C',
          mainRepoPath,
          'checkout',
          mainBranch,
        ]);
        if (!checkout.success) {
          emit('stdout', {
            text: `[pre-deploy] checkout ${mainBranch} 失败，部署中止\n`,
          });
          throw new BadRequestException(
            `无法切换到主分支 ${mainBranch}，请检查分支是否存在`,
          );
        }

        const reset = await this.runCommand('git', [
          '-C',
          mainRepoPath,
          'reset',
          '--hard',
          `origin/${mainBranch}`,
        ]);
        if (!reset.success) {
          emit('stdout', {
            text: '[pre-deploy] 主仓库状态异常，无法对齐远程，部署中止\n',
          });
          throw new BadRequestException('主仓库状态异常，请联系管理员');
        }
        await this.runCommand('git', ['-C', mainRepoPath, 'clean', '-fd']);
      }

      const originalBranch = await this.resolveCurrentBranch(execCwd);
      const gitlabUsername =
        this.configService.get<string>('GITLAB_USERNAME', { infer: true }) ??
        'oauth2';
      const gitlabToken = this.configService.get<string>('GITLAB_TOKEN', {
        infer: true,
      });

      const execEnv: NodeJS.ProcessEnv = {
        ...process.env,
        FORCE_COLOR: '0',
        GIT_AUTHOR_NAME: gitName,
        GIT_AUTHOR_EMAIL: gitEmail,
        GIT_COMMITTER_NAME: gitName,
        GIT_COMMITTER_EMAIL: gitEmail,
      };

      if (gitlabToken) {
        const encodedUsername = encodeURIComponent(gitlabUsername);
        const encodedToken = encodeURIComponent(gitlabToken);
        execEnv.GIT_CONFIG_COUNT = '1';
        execEnv.GIT_CONFIG_KEY_0 = `url.https://${encodedUsername}:${encodedToken}@${this.gitlabHttpAuthHost}/.insteadOf`;
        execEnv.GIT_CONFIG_VALUE_0 = `git@${this.gitlabHttpAuthHost}:`;
      }
      if (isDefaultDeploy && featureBranch) {
        execEnv.BRANCH = featureBranch;
      }

      emit('deploy_start', {
        command: deployCommand,
        cwd: execCwd,
        featureBranch: featureBranch || undefined,
      });

      const idleTimeoutMs = 120_000;
      const { exitCode, aborted, timedOut } = await new Promise<{
        exitCode: number;
        aborted: boolean;
        timedOut: boolean;
      }>((resolve) => {
        let wasAborted = false;
        let wasTimedOut = false;
        let lastActivityTs = Date.now();

        const child = spawn('sh', ['-c', deployCommand], {
          cwd: execCwd,
          env: execEnv,
          stdio: 'pipe',
        });

        const cleanup = () => {
          clearInterval(idleCheckRef);
          signal?.removeEventListener('abort', killChild);
        };

        const killChild = () => {
          wasAborted = true;
          child.kill('SIGTERM');
          setTimeout(() => {
            try {
              child.kill('SIGKILL');
            } catch {
              /* already dead */
            }
          }, 5_000);
        };

        const idleCheckRef = setInterval(() => {
          if (Date.now() - lastActivityTs >= idleTimeoutMs) {
            wasTimedOut = true;
            emit('stderr', {
              text: `\n[timeout] 超过 ${idleTimeoutMs / 1000} 秒无输出，判定为超时，正在终止进程...\n`,
            });
            killChild();
          }
        }, 10_000);

        if (signal?.aborted) {
          killChild();
        } else {
          signal?.addEventListener('abort', killChild, { once: true });
        }

        child.stdout?.on('data', (chunk: Buffer) => {
          lastActivityTs = Date.now();
          const text = chunk.toString('utf-8');
          this.logger.log(`[deploy:stdout] ${text.trimEnd()}`);
          emit('stdout', { text });
        });

        child.stderr?.on('data', (chunk: Buffer) => {
          lastActivityTs = Date.now();
          const text = chunk.toString('utf-8');
          this.logger.warn(`[deploy:stderr] ${text.trimEnd()}`);
          emit('stderr', { text });
        });

        child.on('error', (error) => {
          cleanup();
          emit('stderr', { text: error.message });
          resolve({ exitCode: -1, aborted: wasAborted, timedOut: wasTimedOut });
        });

        child.on('close', (code) => {
          cleanup();
          resolve({
            exitCode: code ?? -1,
            aborted: wasAborted,
            timedOut: wasTimedOut,
          });
        });
      });

      if (exitCode !== 0 && originalBranch) {
        const reason = timedOut
          ? '部署超时'
          : aborted
            ? '部署已取消'
            : '部署失败';
        emit('stderr', {
          text: `\n[auto-rollback] ${reason}，正在恢复分支状态...\n`,
        });
        await this.rollbackWorktree(execCwd, originalBranch, emit);
      }

      emit('deploy_end', { exitCode, aborted, timedOut });
    } finally {
      if (isDefaultDeploy) {
        const mainBranch = project.defaultBranch || 'main';
        const ft = await this.runCommand('git', [
          '-C',
          mainRepoPath,
          'fetch',
          '--all',
        ]);
        if (!ft.success) {
          this.logger.warn(`[deploy-cleanup] fetch --all failed: ${ft.stderr}`);
        }
        const co = await this.runCommand('git', [
          '-C',
          mainRepoPath,
          'checkout',
          mainBranch,
        ]);
        if (!co.success) {
          this.logger.warn(
            `[deploy-cleanup] checkout ${mainBranch} failed: ${co.stderr}`,
          );
        } else {
          const rs = await this.runCommand('git', [
            '-C',
            mainRepoPath,
            'reset',
            '--hard',
            `origin/${mainBranch}`,
          ]);
          if (!rs.success) {
            this.logger.warn(
              `[deploy-cleanup] reset --hard origin/${mainBranch} failed: ${rs.stderr}`,
            );
          }
        }
        const cl = await this.runCommand('git', [
          '-C',
          mainRepoPath,
          'clean',
          '-fd',
        ]);
        if (!cl.success) {
          this.logger.warn(`[deploy-cleanup] clean -fd failed: ${cl.stderr}`);
        }
      }
      this.deployLocks.delete(lockKey);
    }
  }

  // ─── Snapshot-Sync Deploy ──────────────────────────────────────────────────

  async getSubtreeDeployInfo(
    projectId: Project['id'],
    taskId: string,
    currentUser: JwtPayloadType,
  ): Promise<{
    enabled: boolean;
    gitPhase?: string;
    deployStatus?: DeployStatus;
    subtreeConfigs?: SubRepoConfig[];
    canDeploy: boolean;
  }> {
    const project = await this.projectAccessService.assertCanAccessProject(
      projectId,
      currentUser,
    );

    if (!isSnapshotSyncEnabled(project)) {
      return { enabled: false, canDeploy: false };
    }

    const subtreeConfigs = resolveSubRepoConfigs(project.configJson);
    const state = await this.gitStateRepository.getState(projectId);

    const deployablePhases = [
      'task_active',
      'deploy_pending',
      'cleanup_pending',
    ];
    const canDeploy =
      deployablePhases.includes(state.gitPhase) &&
      (!state.activeTaskId || state.activeTaskId === taskId);

    return {
      enabled: true,
      gitPhase: state.gitPhase,
      deployStatus: state.deployStatus,
      subtreeConfigs,
      canDeploy,
    };
  }

  async deploySubtrees(
    projectId: string,
    taskId: string,
    currentUser: JwtPayloadType,
    emit: (event: string, data: Record<string, unknown>) => void,
    options?: { forceOverwrite?: boolean },
  ): Promise<void> {
    const project = await this.projectAccessService.assertCanAccessProject(
      projectId,
      currentUser,
    );

    if (!isSnapshotSyncEnabled(project)) {
      throw new BadRequestException('项目未启用 snapshot-sync 模式');
    }

    const subtreeConfigs = resolveSubRepoConfigs(project.configJson);
    if (subtreeConfigs.length === 0) {
      throw new BadRequestException('未配置子仓');
    }

    if (options?.forceOverwrite) {
      await this.projectAccessService.assertCanManageProject(
        projectId,
        currentUser,
      );
    }

    await this.gitLockService.withProjectGitLock(projectId, async () => {
      const state = await this.gitStateRepository.getState(projectId);
      const { gitPhase } = state;

      const deployablePhases = [
        'task_active',
        'deploy_pending',
        'cleanup_pending',
      ];
      if (!deployablePhases.includes(gitPhase)) {
        throw new BadRequestException(
          `当前 Git 阶段为 '${gitPhase}'，无法执行部署。需要 'task_active'、'deploy_pending' 或 'cleanup_pending'`,
        );
      }

      if (state.activeTaskId && state.activeTaskId !== taskId) {
        throw new BadRequestException(
          `当前活跃任务为 '${state.activeTaskId}'，与请求部署的任务 '${taskId}' 不匹配`,
        );
      }

      const mainRepoPath =
        this.projectRepositoryWorkspaceService.resolveRepositoryRoot(project);
      const defaultBranch = project.defaultBranch || 'main';
      const gitEnv = this.buildGitAuthEnv(currentUser);

      if (gitPhase === 'cleanup_pending') {
        await this.handleCleanupRetry(
          projectId,
          taskId,
          state.deployStatus!,
          mainRepoPath,
          defaultBranch,
          subtreeConfigs,
          emit,
        );
        return;
      }

      const isRetry =
        gitPhase === 'deploy_pending' && !!state.deployStatus?.deployCommitSha;

      emit('deploy_start', {
        taskId,
        subtreeCount: subtreeConfigs.length,
        isRetry,
        gitPhase,
      });

      let deployCommitSha: string;
      let deployStatus: DeployStatus;

      if (isRetry) {
        deployCommitSha = state.deployStatus!.deployCommitSha!;
        deployStatus = { ...state.deployStatus! };
        emit('deploy_step', {
          step: 'reuse_merge',
          message: `复用已有合并提交: ${deployCommitSha.slice(0, 8)}`,
        });

        await this.runCommand(
          'git',
          ['-C', mainRepoPath, 'checkout', defaultBranch],
          { env: gitEnv },
        );
        const headResult = await this.runCommand('git', [
          '-C',
          mainRepoPath,
          'rev-parse',
          'HEAD',
        ]);
        if (headResult.stdout.trim() !== deployCommitSha) {
          await this.runCommand(
            'git',
            ['-C', mainRepoPath, 'reset', '--hard', deployCommitSha],
            { env: gitEnv },
          );
        }
      } else {
        const mergeResult = await this.performMerge(
          projectId,
          taskId,
          project,
          mainRepoPath,
          defaultBranch,
          currentUser,
          gitEnv,
          emit,
        );
        deployCommitSha = mergeResult.deployCommitSha;
        deployStatus = mergeResult.deployStatus;

        await this.gitStateRepository.transitionPhase(
          projectId,
          'task_active',
          'deploy_pending',
        );
        await this.gitStateRepository.setDeployStatus(projectId, deployStatus);
      }

      await this.pushSubtrees(
        projectId,
        mainRepoPath,
        deployCommitSha,
        deployStatus,
        subtreeConfigs,
        gitEnv,
        emit,
        options,
      );

      const allDone = deployStatus.subtrees.every(
        (s) => s.status === 'success' || s.status === 'skipped',
      );

      if (allDone) {
        await this.gitStateRepository.transitionPhase(
          projectId,
          'deploy_pending',
          'cleanup_pending',
        );

        emit('deploy_step', {
          step: 'untrack_push',
          message: '清理子仓目录并推送主仓...',
        });

        await this.subtreeSnapshotService.untrackAndPushMainRepo(
          projectId,
          mainRepoPath,
          subtreeConfigs,
          deployStatus,
          'origin',
          defaultBranch,
        );

        emit('deploy_end', { success: true, deployStatus });
      } else {
        const failedPrefixes = deployStatus.subtrees
          .filter((s) => s.status === 'failed')
          .map((s) => s.prefix);
        emit('deploy_end', {
          success: false,
          deployStatus,
          error: `部分子仓推送失败: ${failedPrefixes.join(', ')}`,
        });
      }
    });
  }

  private async performMerge(
    projectId: string,
    taskId: string,
    project: Project,
    mainRepoPath: string,
    defaultBranch: string,
    currentUser: JwtPayloadType,
    gitEnv: NodeJS.ProcessEnv,
    emit: (event: string, data: Record<string, unknown>) => void,
  ): Promise<{ deployCommitSha: string; deployStatus: DeployStatus }> {
    const task = await this.taskRepository.findById(taskId);
    if (!task || task.projectId !== projectId) {
      throw new NotFoundException('任务不存在或不属于此项目');
    }

    const worktreePath = this.resolveTaskWorktreePathForDeploy(task, project);
    if (!existsSync(worktreePath)) {
      throw new BadRequestException('任务工作目录不存在');
    }

    emit('deploy_step', {
      step: 'check_worktree',
      message: '检查工作区状态...',
    });
    const statusResult = await this.runCommand('git', [
      '-C',
      worktreePath,
      'status',
      '--porcelain',
    ]);
    if (statusResult.success && statusResult.stdout.trim()) {
      throw new BadRequestException(
        '任务工作区存在未提交的更改，请先提交或丢弃后再部署。' +
          `\n未提交文件:\n${statusResult.stdout.trim().split('\n').slice(0, 10).join('\n')}`,
      );
    }

    const taskBranch = await this.resolveCurrentBranch(worktreePath);
    if (!taskBranch) {
      throw new BadRequestException('无法解析任务分支');
    }

    emit('deploy_step', {
      step: 'push_task_branch',
      message: `推送任务分支 ${taskBranch}...`,
    });
    const pushResult = await this.runCommand(
      'git',
      ['-C', worktreePath, 'push', 'origin', taskBranch],
      { env: gitEnv },
    );
    if (!pushResult.success) {
      throw new BadRequestException(`推送任务分支失败: ${pushResult.stderr}`);
    }

    emit('deploy_step', {
      step: 'merge',
      message: `合并 ${taskBranch} 到 ${defaultBranch}...`,
    });

    const fetchResult = await this.runCommand(
      'git',
      ['-C', mainRepoPath, 'fetch', '--all'],
      { env: gitEnv },
    );
    if (!fetchResult.success) {
      throw new BadRequestException(`git fetch 失败: ${fetchResult.stderr}`);
    }

    const checkoutResult = await this.runCommand(
      'git',
      ['-C', mainRepoPath, 'checkout', defaultBranch],
      { env: gitEnv },
    );
    if (!checkoutResult.success) {
      throw new BadRequestException(
        `切换到 ${defaultBranch} 失败: ${checkoutResult.stderr}`,
      );
    }
    const resetResult = await this.runCommand(
      'git',
      ['-C', mainRepoPath, 'reset', '--hard', `origin/${defaultBranch}`],
      { env: gitEnv },
    );
    if (!resetResult.success) {
      throw new BadRequestException(
        `重置 ${defaultBranch} 失败: ${resetResult.stderr}`,
      );
    }

    const gitName = currentUser.username || 'ainative-user';
    const gitEmail = `${currentUser.username || currentUser.sub}@ainative.local`;
    const mergeResult = await this.runCommand(
      'git',
      [
        '-C',
        mainRepoPath,
        '-c',
        `user.name=${gitName}`,
        '-c',
        `user.email=${gitEmail}`,
        'merge',
        '--no-ff',
        `origin/${taskBranch}`,
        '-m',
        `merge: deploy task ${taskId.slice(0, 8)} (snapshot-sync)`,
      ],
      { env: gitEnv },
    );

    if (!mergeResult.success) {
      await this.runCommand('git', ['-C', mainRepoPath, 'merge', '--abort']);
      await this.runCommand(
        'git',
        ['-C', mainRepoPath, 'checkout', defaultBranch],
        { env: gitEnv },
      );
      await this.runCommand(
        'git',
        ['-C', mainRepoPath, 'reset', '--hard', `origin/${defaultBranch}`],
        { env: gitEnv },
      );
      throw new BadRequestException(`合并失败: ${mergeResult.stderr}`);
    }

    const headResult = await this.runCommand('git', [
      '-C',
      mainRepoPath,
      'rev-parse',
      'HEAD',
    ]);
    if (!headResult.success) {
      throw new BadRequestException(
        `获取合并后 HEAD 失败: ${headResult.stderr}`,
      );
    }
    const deployCommitSha = headResult.stdout.trim();

    emit('deploy_step', {
      step: 'merge_done',
      message: `合并完成: ${deployCommitSha.slice(0, 8)}`,
    });

    const state = await this.gitStateRepository.getState(projectId);
    const deployStatus: DeployStatus = {
      snapshotEpoch: state.snapshotEpoch || '',
      deployCommitSha,
      updatedAt: new Date().toISOString(),
      subtrees: resolveSubRepoConfigs(project.configJson).map((c) => ({
        prefix: c.prefix,
        targetBranch: c.branch,
        sourceCommitSha: deployCommitSha,
        status: 'pending' as const,
        attempts: 0,
      })),
      mainRepoPushed: false,
    };

    return { deployCommitSha, deployStatus };
  }

  private async pushSubtrees(
    projectId: string,
    mainRepoPath: string,
    deployCommitSha: string,
    deployStatus: DeployStatus,
    subtreeConfigs: SubRepoConfig[],
    gitEnv: NodeJS.ProcessEnv,
    emit: (event: string, data: Record<string, unknown>) => void,
    options?: { forceOverwrite?: boolean },
  ): Promise<void> {
    for (const item of deployStatus.subtrees) {
      if (item.status === 'success' || item.status === 'skipped') {
        emit('deploy_subtree', {
          prefix: item.prefix,
          status: item.status,
          skippedReason: item.skippedReason,
        });
        continue;
      }

      emit('deploy_step', {
        step: 'push_subtree',
        prefix: item.prefix,
        message: `推送 ${item.prefix} → ${item.targetBranch}...`,
      });

      item.status = 'pushing';
      item.attempts++;

      const config = subtreeConfigs.find((c) => c.prefix === item.prefix);
      if (!config) {
        item.status = 'failed';
        item.error = `Configuration not found for prefix: ${item.prefix}`;
        continue;
      }

      let pushOptions:
        | {
            forceWithLease?: boolean;
            expectedRemoteSha?: string;
          }
        | undefined;
      if (options?.forceOverwrite) {
        const remoteSha = await this.resolveRemoteBranchSha(
          config.url,
          item.targetBranch,
          gitEnv,
        );
        if (remoteSha) {
          pushOptions = {
            forceWithLease: true,
            expectedRemoteSha: remoteSha,
          };
        }
      }

      const result = await this.subtreeSnapshotService.snapshotPushToSubRepo(
        mainRepoPath,
        deployCommitSha,
        item.prefix,
        config.url,
        item.targetBranch,
        pushOptions,
      );

      if (result.success) {
        if (result.skipped) {
          item.status = 'skipped';
          if (result.skippedReason) {
            item.skippedReason = result.skippedReason;
          }
        } else {
          item.status = 'success';
          item.pushedAt = new Date().toISOString();
        }
      } else {
        item.status = 'failed';
        item.error = result.error;
      }

      deployStatus.updatedAt = new Date().toISOString();
      await this.gitStateRepository.setDeployStatus(projectId, deployStatus);

      emit('deploy_subtree', {
        prefix: item.prefix,
        status: item.status,
        error: item.error,
        skippedReason: item.skippedReason,
      });
    }
  }

  private async handleCleanupRetry(
    projectId: string,
    taskId: string,
    deployStatus: DeployStatus,
    mainRepoPath: string,
    defaultBranch: string,
    subtreeConfigs: SubRepoConfig[],
    emit: (event: string, data: Record<string, unknown>) => void,
  ): Promise<void> {
    emit('deploy_start', {
      taskId,
      phase: 'cleanup_pending',
      isRetry: true,
    });
    emit('deploy_step', {
      step: 'untrack_push',
      message: '重试清理：untrack 子仓目录并推送主仓...',
    });

    await this.subtreeSnapshotService.untrackAndPushMainRepo(
      projectId,
      mainRepoPath,
      subtreeConfigs,
      deployStatus,
      'origin',
      defaultBranch,
    );

    emit('deploy_end', { success: true });
  }

  private buildGitAuthEnv(currentUser?: JwtPayloadType): NodeJS.ProcessEnv {
    const env: NodeJS.ProcessEnv = { ...process.env, FORCE_COLOR: '0' };

    if (currentUser) {
      const gitName = currentUser.username || 'ainative-user';
      const gitEmail = `${currentUser.username || currentUser.sub}@ainative.local`;
      env.GIT_AUTHOR_NAME = gitName;
      env.GIT_AUTHOR_EMAIL = gitEmail;
      env.GIT_COMMITTER_NAME = gitName;
      env.GIT_COMMITTER_EMAIL = gitEmail;
    }

    const gitlabToken = this.configService.get<string>('GITLAB_TOKEN', {
      infer: true,
    });
    if (gitlabToken) {
      const gitlabUsername =
        this.configService.get<string>('GITLAB_USERNAME', {
          infer: true,
        }) ?? 'oauth2';
      const encodedUsername = encodeURIComponent(gitlabUsername);
      const encodedToken = encodeURIComponent(gitlabToken);
      env.GIT_CONFIG_COUNT = '1';
      env.GIT_CONFIG_KEY_0 = `url.https://${encodedUsername}:${encodedToken}@${this.gitlabHttpAuthHost}/.insteadOf`;
      env.GIT_CONFIG_VALUE_0 = `git@${this.gitlabHttpAuthHost}:`;
    }

    return env;
  }

  private async resolveRemoteBranchSha(
    remoteUrl: string,
    branch: string,
    env: NodeJS.ProcessEnv,
  ): Promise<string | null> {
    const result = await this.runCommand(
      'git',
      ['ls-remote', remoteUrl, `refs/heads/${branch}`],
      { env },
    );
    if (!result.success || !result.stdout.trim()) return null;
    return result.stdout.split('\t')[0] || null;
  }

  private async resolveCurrentBranch(cwd: string): Promise<string | null> {
    const result = await this.runCommand('git', [
      '-C',
      cwd,
      'rev-parse',
      '--abbrev-ref',
      'HEAD',
    ]);
    if (!result.success) {
      return null;
    }
    const branch = result.stdout.trim();
    if (!branch || branch === 'HEAD') {
      return null;
    }
    return branch;
  }

  private async rollbackWorktree(
    cwd: string,
    originalBranch: string,
    emit: (event: string, data: Record<string, unknown>) => void,
  ): Promise<void> {
    const abortResult = await this.runCommand('git', [
      '-C',
      cwd,
      'merge',
      '--abort',
    ]);
    if (abortResult.success) {
      emit('stderr', { text: '[auto-rollback] git merge --abort 成功\n' });
    }

    const currentBranch = await this.resolveCurrentBranch(cwd);
    if (currentBranch !== originalBranch) {
      const checkoutResult = await this.runCommand('git', [
        '-C',
        cwd,
        'checkout',
        originalBranch,
      ]);
      if (checkoutResult.success) {
        emit('stderr', {
          text: `[auto-rollback] 已切回分支 ${originalBranch}\n`,
        });
      } else {
        emit('stderr', {
          text: `[auto-rollback] 切回分支失败: ${checkoutResult.stderr}\n`,
        });
      }
    }
  }

  private resolveTaskWorktreePathForDeploy(
    task: { id: string; gitWorktree?: string | null },
    project: Project,
  ): string {
    return this.projectWorkspacePathsService.resolveTaskWorktreePath(
      task,
      project,
      {
        preferLegacyExistingPath: true,
      },
    );
  }

  private async runCommand(
    command: string,
    args: string[],
    options?: { env?: NodeJS.ProcessEnv },
  ): Promise<{ success: boolean; stdout: string; stderr: string }> {
    return new Promise((resolve) => {
      const childProcess = spawn(command, args, {
        env: options?.env ?? process.env,
        stdio: 'pipe',
      });

      let stdout = '';
      let stderr = '';

      childProcess.stdout?.on('data', (chunk) => {
        stdout += chunk.toString('utf-8');
      });

      childProcess.stderr?.on('data', (chunk) => {
        stderr += chunk.toString('utf-8');
      });

      const timeoutRef = setTimeout(() => {
        childProcess.kill('SIGTERM');
      }, this.defaultGitTimeoutMs);

      childProcess.on('error', (error) => {
        clearTimeout(timeoutRef);
        resolve({
          success: false,
          stdout: stdout.trimEnd(),
          stderr: error.message,
        });
      });

      childProcess.on('close', (code) => {
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
