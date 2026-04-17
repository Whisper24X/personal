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
  ) {}

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
          await this.runCommand('git', ['-C', worktreePath, 'add', '-A']);
          await this.runCommand('git', [
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
          await this.runCommand('git', [
            '-C',
            worktreePath,
            'push',
            'origin',
            featureBranch,
          ]);
          emit('stdout', {
            text: '[pre-deploy] 已提交并推送到远程\n',
          });
        }

        const mainBranch = project.defaultBranch || 'main';

        const fetch = await this.runCommand('git', ['-C', mainRepoPath, 'fetch', '--all']);
        if (!fetch.success) {
          emit('stdout', { text: '[pre-deploy] git fetch 失败，部署中止\n' });
          throw new BadRequestException('git fetch 失败，请检查网络或仓库配置');
        }

        const checkout = await this.runCommand('git', ['-C', mainRepoPath, 'checkout', mainBranch]);
        if (!checkout.success) {
          emit('stdout', { text: `[pre-deploy] checkout ${mainBranch} 失败，部署中止\n` });
          throw new BadRequestException(`无法切换到主分支 ${mainBranch}，请检查分支是否存在`);
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
        const ft = await this.runCommand('git', ['-C', mainRepoPath, 'fetch', '--all']);
        if (!ft.success) {
          this.logger.warn(`[deploy-cleanup] fetch --all failed: ${ft.stderr}`);
        }
        const co = await this.runCommand('git', ['-C', mainRepoPath, 'checkout', mainBranch]);
        if (!co.success) {
          this.logger.warn(`[deploy-cleanup] checkout ${mainBranch} failed: ${co.stderr}`);
        } else {
          const rs = await this.runCommand('git', [
            '-C', mainRepoPath, 'reset', '--hard', `origin/${mainBranch}`,
          ]);
          if (!rs.success) {
            this.logger.warn(`[deploy-cleanup] reset --hard origin/${mainBranch} failed: ${rs.stderr}`);
          }
        }
        const cl = await this.runCommand('git', ['-C', mainRepoPath, 'clean', '-fd']);
        if (!cl.success) {
          this.logger.warn(`[deploy-cleanup] clean -fd failed: ${cl.stderr}`);
        }
      }
      this.deployLocks.delete(lockKey);
    }
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
  ): Promise<{ success: boolean; stdout: string; stderr: string }> {
    return new Promise((resolve) => {
      const childProcess = spawn(command, args, {
        env: process.env,
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
