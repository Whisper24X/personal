import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
} from '@nestjs/common';
import { spawn } from 'child_process';
import { promises as fs } from 'fs';
import path from 'path';
import { GitBranchActionResultDto } from './dto/git-branch-action-result.dto';
import { GitBranchesDto } from './dto/git-branches.dto';
import {
  GitBranchDetailDto,
  GitBranchesDetailDto,
} from './dto/git-branches-detail.dto';
import { GitLogDto } from './dto/git-log.dto';
import { GitPullMainDto } from './dto/git-pull-main.dto';
import { GitPushResultDto } from './dto/git-push-result.dto';
import { GitStatusDto } from './dto/git-status.dto';
import { GitCreateBranchResultDto } from './dto/git-create-branch-result.dto';
import { GitBranchMergeResultDto } from './dto/git-branch-merge-result.dto';
import { JwtPayloadType } from '../auth/strategies/types/jwt-payload.type';
import { ProjectRepositoryWorkspaceService } from '../projects/project-repository-workspace.service';

type GitCommitAuthor = {
  name: string;
  email: string;
};

@Injectable()
export class GitService {
  private readonly logger = new Logger(GitService.name);
  private readonly defaultGitTimeoutMs = 60_000;
  private readonly fallbackDefaultBranch = 'main';
  private readonly goalDocsDirNamePattern =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

  constructor(
    private readonly projectRepositoryWorkspaceService: ProjectRepositoryWorkspaceService,
  ) {}

  async listBranches(
    projectId: string,
    currentUser: JwtPayloadType,
  ): Promise<GitBranchesDto> {
    const { repositoryRoot, defaultBranch } = await this.resolveProjectContext(
      projectId,
      currentUser,
      { syncRemote: true },
    );
    const snapshot = await this.readBranchSnapshot(
      repositoryRoot,
      defaultBranch,
    );

    return {
      defaultBranch,
      currentBranch: snapshot.currentBranch,
      localBranches: snapshot.localBranches,
      remoteBranches: snapshot.remoteBranches,
    };
  }

  async listBranchesDetail(
    projectId: string,
    currentUser: JwtPayloadType,
  ): Promise<GitBranchesDetailDto> {
    const { repositoryRoot, defaultBranch } = await this.resolveProjectContext(
      projectId,
      currentUser,
      { syncRemote: true },
    );
    const snapshot = await this.readBranchSnapshot(
      repositoryRoot,
      defaultBranch,
    );
    const branches = await this.readBranchDetails(
      repositoryRoot,
      defaultBranch,
      snapshot,
    );

    return {
      branches,
    };
  }

  async pullMain(
    projectId: string,
    currentUser: JwtPayloadType,
  ): Promise<GitPullMainDto> {
    const { repositoryRoot, defaultBranch } = await this.resolveProjectContext(
      projectId,
      currentUser,
      { syncRemote: true },
    );
    const snapshot = await this.readBranchSnapshot(
      repositoryRoot,
      defaultBranch,
    );

    const hasDefaultBranch =
      snapshot.localBranches.includes(defaultBranch) ||
      snapshot.remoteBranches.includes(defaultBranch);

    if (!hasDefaultBranch) {
      throw new BadRequestException(
        `仓库不存在 ${defaultBranch} 分支，无法拉取`,
      );
    }

    if (snapshot.currentBranch !== defaultBranch) {
      throw new BadRequestException(
        `请先切换到 ${defaultBranch} 分支后再执行拉取，避免误更新当前工作分支`,
      );
    }

    const pullResult = await this.executePull(
      repositoryRoot,
      defaultBranch,
      snapshot,
    );

    return {
      branch: defaultBranch,
      output: pullResult.output,
    };
  }

  async pullBranch(
    projectId: string,
    branchName: string,
    currentUser: JwtPayloadType,
  ): Promise<GitBranchActionResultDto> {
    const normalizedBranchName = branchName.trim();
    if (!normalizedBranchName) {
      throw new BadRequestException('分支名不能为空');
    }

    const { repositoryRoot, defaultBranch } = await this.resolveProjectContext(
      projectId,
      currentUser,
      { syncRemote: true },
    );
    const snapshot = await this.readBranchSnapshot(
      repositoryRoot,
      defaultBranch,
    );
    const result = await this.executePull(
      repositoryRoot,
      normalizedBranchName,
      snapshot,
    );

    return {
      success: true,
      branch: normalizedBranchName,
      output: result.output,
    };
  }

  async pushBranch(
    projectId: string,
    branchName: string,
    currentUser: JwtPayloadType,
  ): Promise<GitPushResultDto> {
    const normalizedBranchName = this.normalizeAndAssertBranchName(
      branchName,
      '分支名',
    );

    const { repositoryRoot, defaultBranch } = await this.resolveProjectContext(
      projectId,
      currentUser,
      { syncRemote: true },
    );
    const snapshot = await this.readBranchSnapshot(
      repositoryRoot,
      defaultBranch,
    );

    if (!snapshot.localBranches.includes(normalizedBranchName)) {
      throw new BadRequestException(
        `仓库不存在 ${normalizedBranchName} 本地分支，无法推送`,
      );
    }

    if (snapshot.currentBranch !== normalizedBranchName) {
      throw new BadRequestException(
        `请先切换到 ${normalizedBranchName} 分支后再执行推送，避免误推送其他分支`,
      );
    }

    let pushedCommits = 0;
    const hasRemoteBranch =
      snapshot.remoteBranches.includes(normalizedBranchName);
    if (hasRemoteBranch) {
      const divergence = await this.readBranchDivergence(
        repositoryRoot,
        normalizedBranchName,
        `origin/${normalizedBranchName}`,
      );
      pushedCommits = divergence.ahead;
    } else {
      const countResult = await this.runCommand([
        '-C',
        repositoryRoot,
        'rev-list',
        '--count',
        `${defaultBranch}..${normalizedBranchName}`,
      ]);
      if (countResult.success) {
        pushedCommits = Number.parseInt(countResult.stdout.trim(), 10) || 0;
      }
    }

    const pushResult = await this.runCommand([
      '-C',
      repositoryRoot,
      'push',
      '-u',
      'origin',
      normalizedBranchName,
    ]);

    if (!pushResult.success) {
      throw new BadRequestException(
        this.formatGitFailure(
          `推送 ${normalizedBranchName} 分支失败`,
          pushResult,
        ),
      );
    }

    const output =
      (pushResult.stderr && pushResult.stderr.trim()) ||
      (pushResult.stdout && pushResult.stdout.trim()) ||
      'Push completed.';

    return {
      success: true,
      output,
      pushedCommits,
    };
  }

  async resetBranch(
    projectId: string,
    branchName: string,
    currentUser: JwtPayloadType,
  ): Promise<GitBranchActionResultDto> {
    const normalizedBranchName = branchName.trim();
    if (!normalizedBranchName) {
      throw new BadRequestException('分支名不能为空');
    }

    const { repositoryRoot } = await this.resolveProjectContext(
      projectId,
      currentUser,
      { syncRemote: true },
    );

    const resetResult = await this.runCommand([
      '-C',
      repositoryRoot,
      'reset',
      '--hard',
      `origin/${normalizedBranchName}`,
    ]);

    if (!resetResult.success) {
      throw new BadRequestException(
        this.formatGitFailure(
          `重置 ${normalizedBranchName} 分支失败`,
          resetResult,
        ),
      );
    }

    return {
      success: true,
      branch: normalizedBranchName,
      output: resetResult.stdout || 'HEAD is now at latest origin commit.',
    };
  }

  async createBranch(
    projectId: string,
    name: string,
    fromRef: string,
    currentUser: JwtPayloadType,
    options?: { prepareRequirementBranchWorkingTree?: boolean },
  ): Promise<GitCreateBranchResultDto> {
    const normalizedName = this.normalizeAndAssertBranchName(name, '新分支名');
    const normalizedFrom = this.normalizeAndAssertBranchRef(
      fromRef,
      '基准 ref',
    );

    return this.projectRepositoryWorkspaceService.runWithProjectRepositoryLock(
      projectId,
      currentUser,
      { syncRemote: true },
      async ({ repositoryRoot }) => {
        if (options?.prepareRequirementBranchWorkingTree) {
          const checkout = await this.ensureCheckoutLocalBranch(
            repositoryRoot,
            normalizedFrom,
          );
          if (!checkout.ok) {
            throw new BadRequestException(
              `无法切换到需求分支：${checkout.message}`,
            );
          }

          const statusResult = await this.runCommand([
            '-C',
            repositoryRoot,
            'status',
            '--porcelain',
            '--untracked-files=all',
          ]);
          if (!statusResult.success) {
            throw new BadRequestException(
              this.formatGitFailure('读取需求分支工作区状态失败', statusResult),
            );
          }
          if (statusResult.stdout.trim()) {
            const addResult = await this.runCommand([
              '-C',
              repositoryRoot,
              'add',
              '-A',
            ]);
            if (!addResult.success) {
              throw new BadRequestException(
                this.formatGitFailure('暂存变更失败', addResult),
              );
            }

            const gitName = currentUser.username || 'ainative-user';
            const gitEmail = `${currentUser.username || currentUser.sub}@ainative.local`;
            const commitMsg = `chore(goal): auto-commit before plan branch ${normalizedName}`;
            const commitResult = await this.runCommand([
              '-C',
              repositoryRoot,
              '-c',
              `user.name=${gitName}`,
              '-c',
              `user.email=${gitEmail}`,
              'commit',
              '-m',
              commitMsg,
            ]);
            if (!commitResult.success) {
              throw new BadRequestException(
                this.formatGitFailure('自动提交失败', commitResult),
              );
            }
          }

          const branchFromHead = await this.runCommand([
            '-C',
            repositoryRoot,
            'branch',
            normalizedName,
          ]);
          if (!branchFromHead.success) {
            throw new BadRequestException(
              this.formatGitFailure('创建功能组分支失败', branchFromHead),
            );
          }

          return {
            success: true,
            branch: normalizedName,
          };
        }

        // Resolve the effective fromRef: prefer the local branch name; fall back to
        // the remote-tracking ref (origin/<name>) so that branches which only exist
        // on the remote (and have been fetched but not checked-out locally) can also
        // be used as a base.
        const resolvedFrom = await this.resolveFromRef(
          repositoryRoot,
          normalizedFrom,
        );

        const branchResult = await this.runCommand([
          '-C',
          repositoryRoot,
          'branch',
          normalizedName,
          resolvedFrom,
        ]);

        if (!branchResult.success) {
          throw new BadRequestException(
            this.formatGitFailure('创建分支失败', branchResult),
          );
        }

        return {
          success: true,
          branch: normalizedName,
        };
      },
    );
  }

  /**
   * 在项目主仓库将 `headBranch` 合并入 `baseBranch`（checkout base 后 `git merge --no-ff`）。
   * 成功时当前分支停留在 `baseBranch`（即需求分支上包含合并结果）。
   */
  async mergeBranchIntoBase(
    projectId: string,
    baseBranch: string,
    headBranch: string,
    currentUser: JwtPayloadType,
  ): Promise<GitBranchMergeResultDto> {
    const baseShort = this.normalizeAndAssertBranchName(
      baseBranch,
      '需求分支名',
    );
    const headShort = this.normalizeAndAssertBranchName(
      headBranch,
      '功能组分支名',
    );
    if (baseShort === headShort) {
      throw new BadRequestException('需求分支与功能组分支不能相同');
    }

    return this.projectRepositoryWorkspaceService.runWithProjectRepositoryLock(
      projectId,
      currentUser,
      { syncRemote: true },
      async ({ repositoryRoot }) => {
        const statusResult = await this.runCommand([
          '-C',
          repositoryRoot,
          'status',
          '--porcelain',
          '--untracked-files=all',
        ]);
        if (!statusResult.success) {
          throw new BadRequestException(
            this.formatGitFailure('读取仓库状态失败', statusResult),
          );
        }
        if (statusResult.stdout.trim()) {
          throw new BadRequestException(
            `仓库工作区不干净，请先提交或清理变更后再合并: ${statusResult.stdout.trim()}`,
          );
        }

        const prevRef = await this.runCommand([
          '-C',
          repositoryRoot,
          'rev-parse',
          '--abbrev-ref',
          'HEAD',
        ]);
        if (!prevRef.success) {
          throw new BadRequestException(
            this.formatGitFailure('读取当前分支失败', prevRef),
          );
        }
        const previousBranch = prevRef.stdout.trim();
        if (!previousBranch || previousBranch === 'HEAD') {
          throw new BadRequestException('当前不处于有效分支上，无法安全合并');
        }

        const checkoutBase = await this.ensureCheckoutLocalBranch(
          repositoryRoot,
          baseShort,
        );
        if (!checkoutBase.ok) {
          return {
            success: false,
            message: checkoutBase.message,
          };
        }

        const headMergeRef = await this.resolveMergeRefOrThrow(
          repositoryRoot,
          headShort,
        );

        const mergeResult = await this.runCommand([
          '-C',
          repositoryRoot,
          'merge',
          '--no-ff',
          headMergeRef,
        ]);

        if (!mergeResult.success) {
          const conflicts = await this.readUnmergedPaths(repositoryRoot);
          await this.runCommand(['-C', repositoryRoot, 'merge', '--abort']);
          const back = await this.ensureCheckoutLocalBranch(
            repositoryRoot,
            previousBranch,
          );
          const failureMessage = this.formatGitFailure('合并失败', mergeResult);
          if (!back.ok) {
            return {
              success: false,
              message: `${failureMessage} 且无法切回 ${previousBranch}：${back.message}`,
              conflicts,
            };
          }
          return {
            success: false,
            message: failureMessage,
            conflicts,
          };
        }

        const detail =
          mergeResult.stdout.trim() || mergeResult.stderr.trim() || '';
        return {
          success: true,
          message:
            `已将「${headShort}」合并入「${baseShort}」。` +
            (detail ? ` ${detail}` : ''),
        };
      },
    );
  }

  private async ensureCheckoutLocalBranch(
    repositoryRoot: string,
    branchShort: string,
  ): Promise<{ ok: true } | { ok: false; message: string }> {
    const localOk = await this.runCommand([
      '-C',
      repositoryRoot,
      'rev-parse',
      '--verify',
      `refs/heads/${branchShort}`,
    ]);
    if (localOk.success) {
      const co = await this.runCommand([
        '-C',
        repositoryRoot,
        'checkout',
        branchShort,
      ]);
      return co.success
        ? { ok: true }
        : {
            ok: false,
            message: this.formatGitFailure(`检出 ${branchShort} 失败`, co),
          };
    }

    const remoteOk = await this.runCommand([
      '-C',
      repositoryRoot,
      'rev-parse',
      '--verify',
      `refs/remotes/origin/${branchShort}`,
    ]);
    if (!remoteOk.success) {
      return {
        ok: false,
        message: `仓库中不存在分支 ${branchShort}（本地或 origin/${branchShort}）`,
      };
    }

    const co = await this.runCommand([
      '-C',
      repositoryRoot,
      'checkout',
      '-B',
      branchShort,
      `origin/${branchShort}`,
    ]);
    return co.success
      ? { ok: true }
      : {
          ok: false,
          message: this.formatGitFailure(
            `从远端创建本地分支 ${branchShort} 失败`,
            co,
          ),
        };
  }

  private async resolveMergeRefOrThrow(
    repositoryRoot: string,
    headShort: string,
  ): Promise<string> {
    const localOk = await this.runCommand([
      '-C',
      repositoryRoot,
      'rev-parse',
      '--verify',
      `refs/heads/${headShort}`,
    ]);
    if (localOk.success) {
      return headShort;
    }
    const remoteOk = await this.runCommand([
      '-C',
      repositoryRoot,
      'rev-parse',
      '--verify',
      `refs/remotes/origin/${headShort}`,
    ]);
    if (remoteOk.success) {
      return `origin/${headShort}`;
    }
    throw new BadRequestException(
      `待合并的功能组分支 ${headShort} 在仓库中不存在`,
    );
  }

  private async readUnmergedPaths(repositoryRoot: string): Promise<string[]> {
    const result = await this.runCommand([
      '-C',
      repositoryRoot,
      'diff',
      '--name-only',
      '--diff-filter=U',
    ]);
    if (!result.success) {
      return [];
    }
    return result.stdout
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean);
  }

  /**
   * Returns the most specific ref that exists in the repository for the given
   * branch name.  Resolution order:
   *   1. Local branch (refs/heads/<name>)  – used as-is
   *   2. Remote-tracking ref (origin/<name>) – returned when only the remote
   *      tracking branch exists after a fetch
   *   3. Falls back to the original value so the subsequent `git branch` command
   *      can produce its own diagnostic.
   */
  private async resolveFromRef(
    repositoryRoot: string,
    branchName: string,
  ): Promise<string> {
    const localCheck = await this.runCommand([
      '-C',
      repositoryRoot,
      'rev-parse',
      '--verify',
      `refs/heads/${branchName}`,
    ]);

    if (localCheck.success) {
      return branchName;
    }

    const remoteRef = `origin/${branchName}`;
    const remoteCheck = await this.runCommand([
      '-C',
      repositoryRoot,
      'rev-parse',
      '--verify',
      `refs/remotes/${remoteRef}`,
    ]);

    if (remoteCheck.success) {
      return remoteRef;
    }

    return branchName;
  }

  /**
   * Deletes a local branch under the project repository lock.
   * No-op if the branch does not exist locally, or if the name is a protected branch (main/master/etc.).
   * If the branch is checked out, switches to the project default branch first.
   */
  async deleteLocalBranch(
    projectId: string,
    branchName: string,
    currentUser: JwtPayloadType,
  ): Promise<void> {
    const normalizedName = this.normalizeAndAssertBranchName(
      branchName,
      '分支名',
    );
    if (this.isProtectedBranchName(normalizedName)) {
      return;
    }

    return this.projectRepositoryWorkspaceService.runWithProjectRepositoryLock(
      projectId,
      currentUser,
      { syncRemote: false },
      async ({ project, repositoryRoot }) => {
        const defaultBranch =
          project.defaultBranch?.trim() || this.fallbackDefaultBranch;

        const snapshot = await this.readBranchSnapshot(
          repositoryRoot,
          defaultBranch,
        );

        if (!snapshot.localBranches.includes(normalizedName)) {
          return;
        }

        if (snapshot.currentBranch === normalizedName) {
          if (!snapshot.localBranches.includes(defaultBranch)) {
            throw new ConflictException(
              `无法在删除分支前切换到默认分支 ${defaultBranch}（本地不存在该分支）`,
            );
          }

          const switchResult = await this.runCommand([
            '-C',
            repositoryRoot,
            'switch',
            defaultBranch,
          ]);

          if (!switchResult.success) {
            throw new ConflictException(
              `删除需求分支失败：无法切换到默认分支 ${defaultBranch}（${
                switchResult.stderr || switchResult.stdout || 'unknown'
              }）`,
            );
          }
        }

        const deleteResult = await this.runCommand([
          '-C',
          repositoryRoot,
          'branch',
          '-D',
          normalizedName,
        ]);

        if (!deleteResult.success) {
          throw new ConflictException(
            this.formatGitFailure('删除本地分支失败', deleteResult),
          );
        }
      },
    );
  }

  async readStatus(
    projectId: string,
    currentUser: JwtPayloadType,
  ): Promise<GitStatusDto> {
    const { repositoryRoot, defaultBranch } = await this.resolveProjectContext(
      projectId,
      currentUser,
      { syncRemote: false },
    );

    const [snapshot, workingTreeResult] = await Promise.all([
      this.readBranchSnapshot(repositoryRoot, defaultBranch),
      this.runCommand(['-C', repositoryRoot, 'status', '--porcelain']),
    ]);

    if (!workingTreeResult.success) {
      throw new BadRequestException(
        this.formatGitFailure('读取仓库状态失败', workingTreeResult),
      );
    }

    const changedFilesCount = this.parseChangedFilesCount(
      workingTreeResult.stdout,
    );

    return {
      defaultBranch,
      currentBranch: snapshot.currentBranch,
      isOnDefaultBranch: snapshot.currentBranch === defaultBranch,
      hasUncommittedChanges: changedFilesCount > 0,
      changedFilesCount,
    };
  }

  async readLog(
    projectId: string,
    currentUser: JwtPayloadType,
  ): Promise<GitLogDto> {
    const { repositoryRoot } = await this.resolveProjectContext(
      projectId,
      currentUser,
      { syncRemote: false },
    );

    const logResult = await this.runCommand([
      '-C',
      repositoryRoot,
      'log',
      '--max-count=8',
      '--date=iso-strict',
      '--pretty=format:%H%x1f%h%x1f%an%x1f%cI%x1f%s',
    ]);

    if (!logResult.success) {
      throw new BadRequestException(
        this.formatGitFailure('读取提交记录失败', logResult),
      );
    }

    return {
      commits: this.parseCommits(logResult.stdout),
    };
  }

  /**
   * Stages the given paths (if inside the project repository) and creates a commit when
   * there are staged changes. Swallows errors so callers can treat Git as best-effort.
   */
  async commitProjectPathsIfDirty(
    projectId: string,
    currentUser: JwtPayloadType,
    absolutePaths: string[],
    message: string,
  ): Promise<void> {
    const trimmedMessage = message.trim();
    if (!absolutePaths.length || !trimmedMessage) {
      return;
    }

    try {
      await this.projectRepositoryWorkspaceService.runWithProjectRepositoryLock(
        projectId,
        currentUser,
        { syncRemote: false },
        async ({ repositoryRoot }) => {
          const gitName = currentUser.username || 'ainative-user';
          const gitEmail = `${currentUser.username || currentUser.sub}@ainative.local`;
          await this.commitPathsInRepositoryRootIfDirty(
            repositoryRoot,
            absolutePaths,
            trimmedMessage,
            { name: gitName, email: gitEmail },
          );
        },
      );
    } catch (error) {
      this.logger.warn(
        `commitProjectPathsIfDirty: unexpected error projectId=${projectId} ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  }

  async checkoutBranchInRepository(
    repositoryRoot: string,
    branchName: string,
  ): Promise<void> {
    const normalizedBranchName = this.normalizeAndAssertBranchName(
      branchName,
      '分支名',
    );
    const checkout = await this.ensureCheckoutLocalBranch(
      repositoryRoot,
      normalizedBranchName,
    );
    if (!checkout.ok) {
      throw new BadRequestException(checkout.message);
    }
  }

  async cleanupForeignUntrackedGoalDirs(
    repositoryRoot: string,
    keepGoalId: string,
  ): Promise<void> {
    const root = path.resolve(repositoryRoot);
    const keepId = keepGoalId.trim().toLowerCase();
    const goalsRoot = path.join(root, 'docs', 'goals');
    const entries = await fs
      .readdir(goalsRoot, { withFileTypes: true })
      .catch((error: unknown) => {
        if (
          error &&
          typeof error === 'object' &&
          'code' in error &&
          error.code === 'ENOENT'
        ) {
          return [];
        }
        throw error;
      });

    for (const entry of entries) {
      if (!entry.isDirectory()) {
        continue;
      }

      const goalDirName = entry.name.trim();
      if (
        !this.goalDocsDirNamePattern.test(goalDirName) ||
        goalDirName.toLowerCase() === keepId
      ) {
        continue;
      }

      const relativePath = `docs/goals/${goalDirName}`;
      const trackedResult = await this.runCommand([
        '-C',
        root,
        'ls-files',
        '--',
        relativePath,
      ]);
      if (!trackedResult.success) {
        throw new BadRequestException(
          this.formatGitFailure('检查需求文档跟踪状态失败', trackedResult),
        );
      }
      if (trackedResult.stdout.trim()) {
        continue;
      }

      const cleanResult = await this.runCommand([
        '-C',
        root,
        'clean',
        '-fd',
        '--',
        relativePath,
      ]);
      if (!cleanResult.success) {
        throw new BadRequestException(
          this.formatGitFailure('清理未跟踪需求文档失败', cleanResult),
        );
      }
    }
  }

  async commitPathsInRepositoryRootIfDirty(
    repositoryRoot: string,
    absolutePaths: string[],
    message: string,
    author: GitCommitAuthor,
  ): Promise<boolean> {
    const root = path.resolve(repositoryRoot);
    const trimmedMessage = message.trim();
    if (!absolutePaths.length || !trimmedMessage) {
      return false;
    }

    const relativePaths: string[] = [];
    for (const rawPath of absolutePaths) {
      const absPath = path.resolve(String(rawPath).trim());
      if (!absPath) {
        continue;
      }

      const relPath = path.relative(root, absPath);
      if (!relPath || relPath.startsWith('..') || path.isAbsolute(relPath)) {
        throw new BadRequestException(`提交路径不在项目仓库内: ${absPath}`);
      }

      relativePaths.push(relPath);
    }

    if (!relativePaths.length) {
      return false;
    }

    const addResult = await this.runCommand([
      '-C',
      root,
      'add',
      '--',
      ...relativePaths,
    ]);
    if (!addResult.success) {
      throw new BadRequestException(
        this.formatGitFailure('暂存文档变更失败', addResult),
      );
    }

    const stagedResult = await this.runCommand([
      '-C',
      root,
      'diff',
      '--cached',
      '--name-only',
      '--',
      ...relativePaths,
    ]);
    if (!stagedResult.success) {
      throw new BadRequestException(
        this.formatGitFailure('读取文档暂存状态失败', stagedResult),
      );
    }

    if (!stagedResult.stdout.trim()) {
      return false;
    }

    const commitResult = await this.runCommand([
      '-C',
      root,
      '-c',
      `user.name=${author.name}`,
      '-c',
      `user.email=${author.email}`,
      'commit',
      '-m',
      trimmedMessage,
      '--',
      ...relativePaths,
    ]);
    if (!commitResult.success) {
      throw new BadRequestException(
        this.formatGitFailure('提交文档变更失败', commitResult),
      );
    }

    return true;
  }

  async readStatusForPathsInRepositoryRoot(
    repositoryRoot: string,
    absolutePaths: string[],
  ): Promise<string> {
    const root = path.resolve(repositoryRoot);
    const relativePaths = this.resolveRelativePathsInRepositoryRoot(
      root,
      absolutePaths,
    );
    if (!relativePaths.length) {
      return '';
    }

    const statusResult = await this.runCommand([
      '-C',
      root,
      'status',
      '--porcelain',
      '--untracked-files=all',
      '--',
      ...relativePaths,
    ]);
    if (!statusResult.success) {
      throw new BadRequestException(
        this.formatGitFailure('读取文档工作区状态失败', statusResult),
      );
    }

    return statusResult.stdout.trim();
  }

  async pushBranchInRepository(
    repositoryRoot: string,
    branchName: string,
  ): Promise<void> {
    const normalizedBranchName = this.normalizeAndAssertBranchName(
      branchName,
      '分支名',
    );
    const pushResult = await this.runCommand([
      '-C',
      path.resolve(repositoryRoot),
      'push',
      'origin',
      normalizedBranchName,
    ]);
    if (!pushResult.success) {
      throw new BadRequestException(
        this.formatGitFailure(`推送 ${normalizedBranchName} 失败`, pushResult),
      );
    }
  }

  private static readonly memoryIngestCommitAuthor = {
    name: 'ainative-memory',
    email: 'memory@ainative.local',
  } as const;

  /**
   * Worker-safe: stages paths relative to repository root and commits when the index
   * has changes. Best-effort (logs, no throw). Used after memory ingest writes under docs/memory.
   */
  async commitRelativePathsInRepoRootIfDirty(
    repositoryRoot: string,
    relativePaths: string[],
    message: string,
  ): Promise<void> {
    const trimmedMessage = message.trim();
    if (!relativePaths.length || !trimmedMessage) {
      return;
    }

    try {
      const root = path.resolve(repositoryRoot);
      const safeRelative: string[] = [];

      for (const rawPath of relativePaths) {
        const trimmed = String(rawPath).trim().replace(/\\/g, '/');
        if (!trimmed || trimmed.includes('..')) {
          this.logger.warn(
            `commitRelativePathsInRepoRootIfDirty: skip unsafe path root=${root} path=${rawPath}`,
          );
          continue;
        }

        const absPath = path.resolve(root, trimmed);
        const relPath = path.relative(root, absPath);
        if (!relPath || relPath.startsWith('..') || path.isAbsolute(relPath)) {
          this.logger.warn(
            `commitRelativePathsInRepoRootIfDirty: skip path outside repo root=${root} path=${absPath}`,
          );
          continue;
        }

        safeRelative.push(relPath);
      }

      if (!safeRelative.length) {
        this.logger.warn(
          `commitRelativePathsInRepoRootIfDirty: no valid paths under repositoryRoot=${root}`,
        );
        return;
      }

      const addResult = await this.runCommand([
        '-C',
        root,
        'add',
        '--',
        ...safeRelative,
      ]);

      if (!addResult.success) {
        this.logger.warn(
          `commitRelativePathsInRepoRootIfDirty: ${this.formatGitFailure('git add', addResult)} repositoryRoot=${root}`,
        );
        return;
      }

      const stagedResult = await this.runCommand([
        '-C',
        root,
        'diff',
        '--cached',
        '--name-only',
      ]);

      if (!stagedResult.success) {
        this.logger.warn(
          `commitRelativePathsInRepoRootIfDirty: ${this.formatGitFailure(
            'git diff --cached',
            stagedResult,
          )} repositoryRoot=${root}`,
        );
        return;
      }

      if (!stagedResult.stdout.trim()) {
        return;
      }

      const { name: gitName, email: gitEmail } =
        GitService.memoryIngestCommitAuthor;
      const commitResult = await this.runCommand([
        '-C',
        root,
        '-c',
        `user.name=${gitName}`,
        '-c',
        `user.email=${gitEmail}`,
        'commit',
        '-m',
        trimmedMessage,
      ]);

      if (!commitResult.success) {
        this.logger.warn(
          `commitRelativePathsInRepoRootIfDirty: ${this.formatGitFailure(
            'git commit',
            commitResult,
          )} repositoryRoot=${root}`,
        );
      }
    } catch (error) {
      this.logger.warn(
        `commitRelativePathsInRepoRootIfDirty: unexpected error repositoryRoot=${repositoryRoot} ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  }

  private async resolveProjectContext(
    projectId: string,
    currentUser: JwtPayloadType,
    options: { syncRemote?: boolean } = {},
  ): Promise<{ repositoryRoot: string; defaultBranch: string }> {
    const { project, repositoryRoot } =
      await this.projectRepositoryWorkspaceService.ensureProjectRepositoryReady(
        projectId,
        currentUser,
        options,
      );

    const defaultBranch =
      project.defaultBranch?.trim() || this.fallbackDefaultBranch;

    return {
      repositoryRoot,
      defaultBranch,
    };
  }

  private async readBranchSnapshot(
    repositoryRoot: string,
    defaultBranch: string,
  ): Promise<{
    currentBranch: string | null;
    localBranches: string[];
    remoteBranches: string[];
  }> {
    const [currentBranchResult, localBranchesResult, remoteBranchesResult] =
      await Promise.all([
        this.runCommand([
          '-C',
          repositoryRoot,
          'rev-parse',
          '--abbrev-ref',
          'HEAD',
        ]),
        this.runCommand([
          '-C',
          repositoryRoot,
          'for-each-ref',
          '--format=%(refname:short)',
          'refs/heads',
        ]),
        this.runCommand([
          '-C',
          repositoryRoot,
          'for-each-ref',
          '--format=%(refname:short)',
          'refs/remotes/origin',
        ]),
      ]);

    if (!currentBranchResult.success) {
      throw new BadRequestException(
        this.formatGitFailure('读取当前分支失败', currentBranchResult),
      );
    }

    if (!localBranchesResult.success) {
      throw new BadRequestException(
        this.formatGitFailure('读取本地分支失败', localBranchesResult),
      );
    }

    if (!remoteBranchesResult.success) {
      throw new BadRequestException(
        this.formatGitFailure('读取远端分支失败', remoteBranchesResult),
      );
    }

    const currentBranch = this.normalizeCurrentBranch(
      currentBranchResult.stdout,
    );
    const localBranches = this.sortBranches(
      this.parseBranches(localBranchesResult.stdout),
      defaultBranch,
    );
    const remoteBranches = this.sortBranches(
      this.parseBranches(remoteBranchesResult.stdout)
        .map((branchName) => branchName.replace(/^origin\//, ''))
        .filter((branchName) => branchName && branchName !== 'HEAD'),
      defaultBranch,
    );

    return {
      currentBranch,
      localBranches,
      remoteBranches,
    };
  }

  private normalizeCurrentBranch(value: string): string | null {
    const normalized = value.trim();

    if (!normalized || normalized === 'HEAD') {
      return null;
    }

    return normalized;
  }

  private async readBranchDetails(
    repositoryRoot: string,
    defaultBranch: string,
    snapshot: {
      currentBranch: string | null;
      localBranches: string[];
      remoteBranches: string[];
    },
  ): Promise<GitBranchDetailDto[]> {
    const detailsResult = await this.runCommand([
      '-C',
      repositoryRoot,
      'for-each-ref',
      '--format=%(refname:short)%x1f%(objectname)%x1f%(objectname:short)%x1f%(authorname)%x1f%(committerdate:iso-strict)%x1f%(contents:subject)',
      'refs/heads',
      'refs/remotes/origin',
    ]);

    if (!detailsResult.success) {
      throw new BadRequestException(
        this.formatGitFailure('读取分支详情失败', detailsResult),
      );
    }

    const commitMap = this.parseBranchCommitDetails(detailsResult.stdout);
    const localBranchSet = new Set(snapshot.localBranches);
    const remoteBranchSet = new Set(snapshot.remoteBranches);
    const branchNames = this.sortBranches(
      [...new Set([...snapshot.localBranches, ...snapshot.remoteBranches])],
      defaultBranch,
    );

    return Promise.all(
      branchNames.map(async (branchName) => {
        const hasLocal = localBranchSet.has(branchName);
        const hasRemote = remoteBranchSet.has(branchName);
        let ahead = 0;
        let behind = 0;
        let tracking: string | undefined;

        if (hasLocal && hasRemote) {
          tracking = `origin/${branchName}`;
          const divergence = await this.readBranchDivergence(
            repositoryRoot,
            branchName,
            tracking,
          );
          ahead = divergence.ahead;
          behind = divergence.behind;
        }

        const preferredRef = hasLocal ? branchName : `origin/${branchName}`;
        const fallbackRef = `origin/${branchName}`;
        const lastCommit =
          commitMap.get(preferredRef) ??
          commitMap.get(fallbackRef) ??
          this.createEmptyBranchCommit();

        return {
          name: branchName,
          type: hasLocal && hasRemote ? 'both' : hasLocal ? 'local' : 'remote',
          isCurrent: snapshot.currentBranch === branchName,
          tracking,
          ahead,
          behind,
          lastCommit,
        };
      }),
    );
  }

  private parseBranches(stdout: string): string[] {
    return Array.from(
      new Set(
        stdout
          .split('\n')
          .map((line) => line.trim())
          .filter(Boolean),
      ),
    );
  }

  private parseChangedFilesCount(stdout: string): number {
    return stdout
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean).length;
  }

  private resolveRelativePathsInRepositoryRoot(
    repositoryRoot: string,
    absolutePaths: string[],
  ): string[] {
    const root = path.resolve(repositoryRoot);
    const relativePaths: string[] = [];

    for (const rawPath of absolutePaths) {
      const absPath = path.resolve(String(rawPath).trim());
      if (!absPath) {
        continue;
      }

      const relPath = path.relative(root, absPath);
      if (!relPath || relPath.startsWith('..') || path.isAbsolute(relPath)) {
        throw new BadRequestException(`提交路径不在项目仓库内: ${absPath}`);
      }

      relativePaths.push(relPath);
    }

    return relativePaths;
  }

  private parseCommits(stdout: string): GitLogDto['commits'] {
    return stdout
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => {
        const [sha, shortSha, authorName, committedAt, ...messageParts] =
          line.split('\x1f');

        return {
          sha: sha || '',
          shortSha: shortSha || '',
          authorName: authorName || '',
          committedAt: committedAt || '',
          message: messageParts.join('\x1f') || '',
        };
      })
      .filter((commit) => commit.sha && commit.shortSha);
  }

  private parseBranchCommitDetails(
    stdout: string,
  ): Map<string, GitBranchDetailDto['lastCommit']> {
    const result = new Map<string, GitBranchDetailDto['lastCommit']>();

    for (const line of stdout.split('\n')) {
      const normalizedLine = line.trim();
      if (!normalizedLine) {
        continue;
      }

      const [refName, sha, shortSha, author, committedAt, ...messageParts] =
        normalizedLine.split('\x1f');

      if (!refName) {
        continue;
      }

      result.set(refName, {
        sha: sha || '',
        shortSha: shortSha || '',
        author: author || '',
        committedAt: committedAt || '',
        message: messageParts.join('\x1f') || '',
      });
    }

    return result;
  }

  private createEmptyBranchCommit(): GitBranchDetailDto['lastCommit'] {
    return {
      sha: '',
      shortSha: '',
      author: '',
      committedAt: '',
      message: '',
    };
  }

  private async readBranchDivergence(
    repositoryRoot: string,
    localRef: string,
    remoteRef: string,
  ): Promise<{ ahead: number; behind: number }> {
    const divergenceResult = await this.runCommand([
      '-C',
      repositoryRoot,
      'rev-list',
      '--left-right',
      '--count',
      `${localRef}...${remoteRef}`,
    ]);

    if (!divergenceResult.success) {
      throw new BadRequestException(
        this.formatGitFailure(
          `读取分支 ${localRef} 同步状态失败`,
          divergenceResult,
        ),
      );
    }

    const [aheadRaw, behindRaw] = divergenceResult.stdout
      .trim()
      .split(/\s+/)
      .slice(0, 2);

    return {
      ahead: Number.parseInt(aheadRaw || '0', 10) || 0,
      behind: Number.parseInt(behindRaw || '0', 10) || 0,
    };
  }

  private async executePull(
    repositoryRoot: string,
    branchName: string,
    snapshot: {
      currentBranch: string | null;
      localBranches: string[];
      remoteBranches: string[];
    },
  ): Promise<{ output: string }> {
    const hasLocalBranch = snapshot.localBranches.includes(branchName);
    const hasRemoteBranch = snapshot.remoteBranches.includes(branchName);

    if (!hasLocalBranch && !hasRemoteBranch) {
      throw new BadRequestException(`仓库不存在 ${branchName} 分支，无法拉取`);
    }

    if (!hasLocalBranch) {
      throw new BadRequestException(
        `分支 ${branchName} 仅存在于远端，请先检出本地分支后再拉取`,
      );
    }

    if (!hasRemoteBranch) {
      throw new BadRequestException(
        `分支 ${branchName} 未关联 origin 远端分支，无法执行拉取`,
      );
    }

    if (snapshot.currentBranch !== branchName) {
      throw new BadRequestException(
        `请先切换到 ${branchName} 分支后再执行拉取，避免误更新当前工作分支`,
      );
    }

    const pullResult = await this.runCommand([
      '-C',
      repositoryRoot,
      'pull',
      '--ff-only',
      'origin',
      branchName,
    ]);

    if (!pullResult.success) {
      throw new BadRequestException(
        this.formatGitFailure(`拉取 ${branchName} 分支失败`, pullResult),
      );
    }

    return {
      output: pullResult.stdout || pullResult.stderr || 'Already up to date.',
    };
  }

  private sortBranches(branches: string[], defaultBranch: string): string[] {
    return [...new Set(branches)].sort((left, right) => {
      const priorityDiff =
        this.resolveBranchPriority(left, defaultBranch) -
        this.resolveBranchPriority(right, defaultBranch);

      if (priorityDiff !== 0) {
        return priorityDiff;
      }

      return left.localeCompare(right);
    });
  }

  private resolveBranchPriority(
    branchName: string,
    defaultBranch: string,
  ): number {
    if (branchName === defaultBranch) {
      return 0;
    }

    if (branchName === 'main') {
      return 1;
    }

    if (branchName === 'master') {
      return 2;
    }

    return 3;
  }

  /** Aligns with TaskRuntimeService protected branch rules for branch -D. */
  private isProtectedBranchName(branchName: string): boolean {
    const protectedNames = ['main', 'master', 'develop', 'dev', 'release'];
    const lower = branchName.toLowerCase();
    return protectedNames.includes(lower) || lower.startsWith('release/');
  }

  private normalizeAndAssertBranchName(value: string, label: string): string {
    const normalized = value.trim();
    if (!normalized) {
      throw new BadRequestException(`${label}不能为空`);
    }
    this.assertSafeGitRefName(normalized, label, 255);
    return normalized;
  }

  private normalizeAndAssertBranchRef(value: string, label: string): string {
    const normalized = value.trim();
    if (!normalized) {
      throw new BadRequestException(`${label}不能为空`);
    }
    this.assertSafeGitRefName(normalized, label, 512);
    return normalized;
  }

  /**
   * Rejects obviously invalid or unsafe ref names (injection via odd bytes, path tricks).
   * Aligns loosely with git check-ref-format for branch-like names.
   */
  private assertSafeGitRefName(
    value: string,
    label: string,
    maxLen: number,
  ): void {
    if (value.length > maxLen) {
      throw new BadRequestException(`${label}过长`);
    }
    if (value.includes('..') || value.includes('//')) {
      throw new BadRequestException(`${label}包含非法序列`);
    }
    if (/[\s\x00-\x1f\x7f]/.test(value)) {
      throw new BadRequestException(`${label}不能包含空白或控制字符`);
    }
    if (value.startsWith('-')) {
      throw new BadRequestException(`${label}不能以 - 开头`);
    }
    if (value.endsWith('.') || value.endsWith('/')) {
      throw new BadRequestException(`${label}不能以 . 或 / 结尾`);
    }
    if (value.includes('\\') || value.includes('~') || value.includes('^')) {
      throw new BadRequestException(`${label}包含非法字符`);
    }
    const reserved = new Set([
      'HEAD',
      'FETCH_HEAD',
      'ORIG_HEAD',
      'MERGE_HEAD',
      'CHERRY_PICK_HEAD',
    ]);
    if (reserved.has(value)) {
      throw new BadRequestException(`${label}不能使用保留名`);
    }
  }

  private formatGitFailure(
    summary: string,
    result: { stdout: string; stderr: string },
  ): string {
    const details = result.stderr || result.stdout;
    const normalizedDetails = details.trim();
    if (!normalizedDetails) {
      return summary;
    }

    if (normalizedDetails.length <= 500) {
      return `${summary}: ${normalizedDetails}`;
    }

    return `${summary}: ${normalizedDetails.slice(0, 500)}...`;
  }

  private async runCommand(
    args: string[],
  ): Promise<{ success: boolean; stdout: string; stderr: string }> {
    return new Promise((resolve) => {
      const childProcess = spawn('git', args, {
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
