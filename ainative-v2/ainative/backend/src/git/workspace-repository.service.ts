import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'crypto';
import { spawn } from 'child_process';
import { mkdir, access, rm, readdir, stat } from 'fs/promises';
import path from 'path';

import { SubRepoConfig } from './sub-repo.types';
import { WorkspaceGitLockService } from './workspace-git-lock.service';
import { resolveGitRemoteUrlWithHttpAuth } from './git-remote-auth.util';
import { AllConfigType } from '../config/config.type';
import { resolveAinativeDataRootDir } from '../utils/workspace-paths';

const DEFAULT_GIT_TIMEOUT_MS = 120_000;
const CLONE_TIMEOUT_MS = 300_000;
const MASS_DELETE_RATIO_LIMIT = 0.8;
const MASS_DELETE_MIN_FILE_COUNT = 10;

export interface CreateTaskWorktreeResult {
  worktreePath: string;
  taskBranch: string;
  snapshotCommitSha: string;
  subRepoHeads: Record<string, string>;
  pushDeferred?: boolean;
}

export type CreateTaskWorktreeStage =
  | 'syncing_base'
  | 'creating_worktree'
  | 'fetching_sub_repos'
  | 'embedding_sub_repos'
  | 'writing_runner_config'
  | 'committing_snapshot'
  | 'pushing_snapshot';

export type CreateTaskWorktreeProgress = {
  stage: CreateTaskWorktreeStage;
  message: string;
};

export interface RemoveTaskWorktreeResult {
  worktreeRemoved: boolean;
  localBranchDeleted: boolean;
  remoteBranchDeleted: boolean;
  subRepoBranchResults: {
    prefix: string;
    url: string;
    remoteBranch: string;
    deleted: boolean;
    error?: string;
    blockedByMR?: boolean;
    mrUrl?: string;
  }[];
}

export interface EmbedSubReposOntoBranchResult {
  branchName: string;
  commitSha: string;
  changed: boolean;
  subRepoHeads: Record<string, string>;
}

@Injectable()
export class WorkspaceRepositoryService {
  private readonly logger = new Logger(WorkspaceRepositoryService.name);
  private readonly gitTimeoutMs: number;
  private readonly gitlabHttpAuthHost: string;

  constructor(
    private readonly lockService: WorkspaceGitLockService,
    private readonly configService: ConfigService<AllConfigType>,
  ) {
    this.gitTimeoutMs =
      this.configService.get<number>('SUBTREE_CLONE_TIMEOUT_MS', {
        infer: true,
      }) ?? DEFAULT_GIT_TIMEOUT_MS;
    this.gitlabHttpAuthHost =
      this.configService.get<string>('GITLAB_HTTP_AUTH_HOST', {
        infer: true,
      }) ?? 'gitlab.yc345.tv';
  }

  // ─── Core: ensureClone ──────────────────────────────────────────────────────

  /**
   * @param cloneOptions.skipFetchIfPresent When true and `.git` already exists, skip fetching the template base branch (no network).
   */
  async ensureClone(
    repositoryRoot: string,
    cloneOptions?: { skipFetchIfPresent?: boolean },
  ): Promise<void> {
    return this.lockService.withLock(repositoryRoot, async () => {
      if (await this.pathExists(path.join(repositoryRoot, '.git'))) {
        if (cloneOptions?.skipFetchIfPresent === true) {
          return;
        }
        const baseBranch = this.getBaseBranch();
        await this.mustGit(repositoryRoot, [
          'fetch',
          'origin',
          `+refs/heads/${baseBranch}:refs/remotes/origin/${baseBranch}`,
        ]);
        return;
      }

      const parentDir = path.dirname(repositoryRoot);
      await mkdir(parentDir, { recursive: true });

      const gitUrl = this.getResolvedWorkspaceGitUrl();
      const baseBranch = this.getBaseBranch();

      await this.mustGitWithTimeout(
        parentDir,
        ['clone', '--no-checkout', '-b', baseBranch, gitUrl, repositoryRoot],
        CLONE_TIMEOUT_MS,
      );

      await this.mustGit(repositoryRoot, ['checkout', baseBranch]);
    });
  }

  /**
   * Ensures `branchName` tip tree contains an embedded **directory** at each `prefix` path
   * (same layout as `read-tree --prefix=` / `ensureSubRepoEmbedded`). Prefixes may be nested
   * (e.g. `packages/app`); not only root-level directory names.
   * @param remoteSyncBranch Branch to fetch from origin first (e.g. gitBaseBranch), not `branchName` when demand exists only locally.
   */
  async branchIncludesTopLevelPrefixes(
    repositoryRoot: string,
    branchName: string,
    remoteSyncBranch: string,
    prefixes: string[],
  ): Promise<boolean> {
    if (prefixes.length === 0) {
      return true;
    }
    await this.ensureClone(repositoryRoot);
    const normalized = prefixes.map((p) => p.trim().replace(/\/+$/, ''));
    const syncBranch = remoteSyncBranch.trim() || this.getBaseBranch();
    await this.lockService.withLock(repositoryRoot, async () => {
      await this.mustGit(repositoryRoot, [
        'fetch',
        'origin',
        `+refs/heads/${syncBranch}:refs/remotes/origin/${syncBranch}`,
      ]);
    });
    const ref = await this.resolveBranchRefForRevParse(
      repositoryRoot,
      branchName,
    );
    const sha = (
      await this.mustGit(repositoryRoot, ['rev-parse', ref])
    ).stdout.trim();

    for (const p of normalized) {
      if (
        !(await this.embeddedSubRepoTreeExistsAtRevPath(repositoryRoot, sha, p))
      ) {
        return false;
      }
    }
    return true;
  }

  /**
   * Embeds sub-repo trees onto an existing branch (e.g. demand branch) and pushes.
   * @param remoteSyncBranch Branch to fetch from origin before worktree (e.g. gitBaseBranch), not `branchName` when demand exists only locally.
   */
  async embedSubReposOntoBranch(
    repositoryRoot: string,
    branchName: string,
    subRepos: SubRepoConfig[],
    remoteSyncBranch: string,
  ): Promise<EmbedSubReposOntoBranchResult> {
    await this.ensureClone(repositoryRoot);
    const syncBranch = remoteSyncBranch.trim() || this.getBaseBranch();
    if (subRepos.length === 0) {
      const ref = await this.resolveBranchRefForRevParse(
        repositoryRoot,
        branchName,
      );
      const sha = (
        await this.mustGit(repositoryRoot, ['rev-parse', ref])
      ).stdout.trim();
      return {
        branchName,
        commitSha: sha,
        changed: false,
        subRepoHeads: {},
      };
    }

    const parentDir = path.join(
      path.dirname(repositoryRoot),
      '.ainative-goal-embed-parent',
    );
    const worktreeId = randomUUID();
    const safe = branchName.replace(/[/\\]/g, '--');
    const worktreePath = path.join(parentDir, `${safe}-${worktreeId}`);
    const refSlug = `goal-embed-${safe}`;

    const subRepoHeads: Record<string, string> = {};

    await mkdir(parentDir, { recursive: true });

    try {
      await this.lockService.withLock(repositoryRoot, async () => {
        await this.mustGit(repositoryRoot, [
          'fetch',
          'origin',
          `+refs/heads/${syncBranch}:refs/remotes/origin/${syncBranch}`,
        ]);

        let hasLocal = await this.branchExistsLocally(
          repositoryRoot,
          branchName,
        );

        if (!hasLocal) {
          const remoteTracking = `refs/remotes/origin/${branchName}`;
          const remoteVerify = await this.runGit(repositoryRoot, [
            'rev-parse',
            '--verify',
            remoteTracking,
          ]);
          if (!remoteVerify.success) {
            throw new Error(
              `Branch ${branchName} not found locally or on origin`,
            );
          }
          await this.mustGit(repositoryRoot, [
            'branch',
            branchName,
            remoteTracking,
          ]);
          hasLocal = true;
        }

        await this.mustGit(repositoryRoot, [
          'worktree',
          'add',
          worktreePath,
          branchName,
        ]);
      });

      const fetchResults = await Promise.all(
        subRepos.map((subRepo) =>
          this.fetchSubRepo(worktreePath, subRepo, refSlug),
        ),
      );

      for (let i = 0; i < subRepos.length; i++) {
        const subRepo = subRepos[i];
        const sha = fetchResults[i];
        await this.ensureSubRepoEmbedded(worktreePath, subRepo, sha);
        subRepoHeads[subRepo.prefix] = sha;
      }

      const statusOutput = (
        await this.mustGit(worktreePath, ['status', '--porcelain'])
      ).stdout.trim();

      const changed = Boolean(statusOutput);
      if (changed) {
        await this.mustGit(worktreePath, ['add', '-A']);
        await this.mustGit(worktreePath, [
          '-c',
          'user.name=AINative',
          '-c',
          'user.email=ainative@local',
          'commit',
          '-m',
          `workspace: embed sub-repos on goal branch ${branchName}`,
        ]);
      }

      const commitSha = (
        await this.mustGit(worktreePath, ['rev-parse', 'HEAD'])
      ).stdout.trim();

      await this.lockService.withLock(repositoryRoot, async () => {
        await this.mustGit(repositoryRoot, [
          'push',
          'origin',
          `${branchName}:${branchName}`,
        ]);
      });

      return {
        branchName,
        commitSha,
        changed,
        subRepoHeads,
      };
    } finally {
      await this.lockService
        .withLock(repositoryRoot, async () => {
          if (await this.pathExists(worktreePath)) {
            const removeResult = await this.runGit(repositoryRoot, [
              'worktree',
              'remove',
              '--force',
              worktreePath,
            ]);
            if (!removeResult.success) {
              await rm(worktreePath, { recursive: true, force: true }).catch(
                () => undefined,
              );
              await this.runGit(repositoryRoot, ['worktree', 'prune']);
            }
          }
        })
        .catch(() => undefined);
      await rm(worktreePath, { recursive: true, force: true }).catch(
        () => undefined,
      );
    }
  }

  // ─── Core: createTaskWorktree ───────────────────────────────────────────────

  async createTaskWorktree(
    repositoryRoot: string,
    worktreeBaseDir: string,
    taskBranch: string,
    subRepos: SubRepoConfig[],
    options?: {
      /** When set, task branch is forked from this branch instead of the workspace template base. */
      baseBranch?: string;
      /**
       * When true, skip sub-repo remote fetch + read-tree embed if HEAD already has all `subRepos` top-level prefixes
       * (e.g. task forked from a functional-group branch that already embedded sub-repos). Falls back to full embed if any prefix is missing.
       */
      reuseEmbeddedSubtrees?: boolean;
      /** Called after sub-repos are embedded but before commit. Use to write runner config etc. */
      beforeCommit?: (
        worktreePath: string,
        subRepoHeads: Record<string, string>,
      ) => Promise<void>;
      /**
       * Goal materialize / functional-group base only: no template fetch, no fetch for base branch, base ref must be
       * `refs/heads/<baseBranch>`, and do not push the task branch. Plain workspace-native task creation omits this.
       */
      localMaterializeTaskWorktree?: boolean;
      deferPush?: boolean;
      onProgress?: (progress: CreateTaskWorktreeProgress) => Promise<void>;
    },
  ): Promise<CreateTaskWorktreeResult> {
    const localMaterialize = options?.localMaterializeTaskWorktree === true;
    await this.emitTaskWorktreeProgress(options, {
      stage: 'syncing_base',
      message: '正在同步 workspace 模板仓库',
    });

    await this.ensureClone(
      repositoryRoot,
      localMaterialize ? { skipFetchIfPresent: true } : undefined,
    );

    const effectiveBaseBranch =
      options?.baseBranch?.trim() || this.getBaseBranch();
    const worktreePath = path.join(worktreeBaseDir, taskBranch);

    const subRepoHeads: Record<string, string> = {};
    const refSlug = taskBranch.replace(/\//g, '--');

    await this.lockService.withLock(repositoryRoot, async () => {
      if (!localMaterialize) {
        await this.emitTaskWorktreeProgress(options, {
          stage: 'syncing_base',
          message: '正在拉取 workspace 模板分支',
        });
        await this.mustGit(repositoryRoot, [
          'fetch',
          'origin',
          `+refs/heads/${effectiveBaseBranch}:refs/remotes/origin/${effectiveBaseBranch}`,
        ]);
      }

      const baseRef = localMaterialize
        ? await this.resolveLocalBranchRefOnly(
            repositoryRoot,
            effectiveBaseBranch,
          )
        : await this.resolveBranchRefForRevParse(
            repositoryRoot,
            effectiveBaseBranch,
          );

      const baseSha = (
        await this.mustGit(repositoryRoot, ['rev-parse', baseRef])
      ).stdout.trim();

      const branchExists = await this.branchExistsLocally(
        repositoryRoot,
        taskBranch,
      );

      if (branchExists) {
        await this.mustGit(repositoryRoot, ['branch', '-D', taskBranch]);
      }

      await this.mustGit(repositoryRoot, ['branch', taskBranch, baseSha]);

      await mkdir(worktreeBaseDir, { recursive: true });

      await this.emitTaskWorktreeProgress(options, {
        stage: 'creating_worktree',
        message: '正在创建任务 worktree',
      });
      await this.mustGit(repositoryRoot, [
        'worktree',
        'add',
        worktreePath,
        taskBranch,
      ]);
    });

    try {
      const reusedHeads =
        options?.reuseEmbeddedSubtrees === true
          ? await this.tryResolveEmbeddedSubRepoHeads(worktreePath, subRepos)
          : null;

      if (reusedHeads !== null) {
        Object.assign(subRepoHeads, reusedHeads);
      } else {
        await this.emitTaskWorktreeProgress(options, {
          stage: 'fetching_sub_repos',
          message: '正在拉取子仓代码',
        });
        const fetchResults = await Promise.all(
          subRepos.map((subRepo) =>
            this.fetchSubRepo(worktreePath, subRepo, refSlug),
          ),
        );

        await this.emitTaskWorktreeProgress(options, {
          stage: 'embedding_sub_repos',
          message: '正在拼接子仓到任务工作区',
        });
        for (let i = 0; i < subRepos.length; i++) {
          const subRepo = subRepos[i];
          const sha = fetchResults[i];
          await this.ensureSubRepoEmbedded(worktreePath, subRepo, sha);
          subRepoHeads[subRepo.prefix] = sha;
        }
      }

      if (options?.beforeCommit) {
        await this.emitTaskWorktreeProgress(options, {
          stage: 'writing_runner_config',
          message: '正在写入 runner 配置',
        });
        await options.beforeCommit(worktreePath, subRepoHeads);
      }

      const statusOutput = (
        await this.mustGit(worktreePath, ['status', '--porcelain'])
      ).stdout.trim();

      if (statusOutput) {
        await this.emitTaskWorktreeProgress(options, {
          stage: 'committing_snapshot',
          message: '正在提交本地 workspace snapshot',
        });
        await this.mustGit(worktreePath, ['add', '-A']);
        await this.mustGit(worktreePath, [
          '-c',
          'user.name=AINative',
          '-c',
          'user.email=ainative@local',
          'commit',
          '-m',
          `workspace: embed sub-repos for ${taskBranch}`,
        ]);
      }
    } catch (error) {
      await this.rollbackWorktreeCreation(
        repositoryRoot,
        worktreePath,
        taskBranch,
      );
      throw error;
    }

    const snapshotCommitSha = (
      await this.mustGit(worktreePath, ['rev-parse', 'HEAD'])
    ).stdout.trim();

    if (!localMaterialize && !options?.deferPush) {
      try {
        await this.emitTaskWorktreeProgress(options, {
          stage: 'pushing_snapshot',
          message: '正在推送任务 workspace snapshot',
        });
        await this.pushTaskBranch(repositoryRoot, taskBranch);
      } catch (error) {
        await this.rollbackWorktreeCreation(
          repositoryRoot,
          worktreePath,
          taskBranch,
        );
        throw error;
      }
    }

    return {
      worktreePath,
      taskBranch,
      snapshotCommitSha,
      subRepoHeads,
      pushDeferred: options?.deferPush === true,
    };
  }

  async pushTaskBranch(
    repositoryRoot: string,
    taskBranch: string,
  ): Promise<void> {
    await this.lockService.withLock(repositoryRoot, async () => {
      await this.mustGit(repositoryRoot, [
        'push',
        'origin',
        `${taskBranch}:${taskBranch}`,
      ]);
    });
  }

  private async emitTaskWorktreeProgress(
    options:
      | {
          onProgress?: (progress: CreateTaskWorktreeProgress) => Promise<void>;
        }
      | undefined,
    progress: CreateTaskWorktreeProgress,
  ): Promise<void> {
    await options?.onProgress?.(progress);
  }

  private async rollbackWorktreeCreation(
    repositoryRoot: string,
    worktreePath: string,
    taskBranch: string,
  ): Promise<void> {
    const removeResult = await this.runGit(repositoryRoot, [
      'worktree',
      'remove',
      '--force',
      worktreePath,
    ]);
    if (!removeResult.success) {
      await rm(worktreePath, { recursive: true, force: true }).catch(
        () => undefined,
      );
      await this.runGit(repositoryRoot, ['worktree', 'prune']);
    }
    await this.runGit(repositoryRoot, ['branch', '-D', taskBranch]);
    this.logger.warn(`Rolled back worktree creation for ${taskBranch}`);
  }

  // ─── Core: removeTaskWorktree ───────────────────────────────────────────────

  async removeTaskWorktree(
    repositoryRoot: string,
    taskBranch: string,
    worktreePath: string,
    subRepoDeployBranches?: {
      prefix: string;
      url: string;
      remoteBranch: string;
    }[],
    options?: { force?: boolean },
  ): Promise<RemoveTaskWorktreeResult> {
    const result: RemoveTaskWorktreeResult = {
      worktreeRemoved: false,
      localBranchDeleted: false,
      remoteBranchDeleted: false,
      subRepoBranchResults: [],
    };

    await this.lockService.withLock(repositoryRoot, async () => {
      if (await this.pathExists(worktreePath)) {
        const worktreeResult = await this.runGit(repositoryRoot, [
          'worktree',
          'remove',
          '--force',
          worktreePath,
        ]);
        result.worktreeRemoved = worktreeResult.success;
      }

      if (await this.branchExistsLocally(repositoryRoot, taskBranch)) {
        const branchResult = await this.runGit(repositoryRoot, [
          'branch',
          '-D',
          taskBranch,
        ]);
        result.localBranchDeleted = branchResult.success;
      }

      const remotePushResult = await this.runGit(repositoryRoot, [
        'push',
        'origin',
        '--delete',
        taskBranch,
      ]);
      const remoteStderr = remotePushResult.stderr ?? '';
      const refNotExist =
        remoteStderr.includes('remote ref does not exist') ||
        remoteStderr.includes('could not read ref');
      result.remoteBranchDeleted = remotePushResult.success || refNotExist;
    });

    if (subRepoDeployBranches?.length) {
      for (const branch of subRepoDeployBranches) {
        const deleteResult = await this.deleteSubRepoRemoteBranch(
          repositoryRoot,
          branch,
          options,
        );
        result.subRepoBranchResults.push(deleteResult);
      }
    }

    return result;
  }

  // ─── Core: deployToSubRepo ──────────────────────────────────────────────────
  //
  // Uses git subtree split to extract prefix history, then pushes directly.
  // Falls back to fetch+merge for non-fast-forward, or bare-repo init for
  // first-time branch creation.

  async deployToSubRepo(
    worktreePath: string,
    subRepo: SubRepoConfig,
    deployCommitSha: string,
    subRepoTaskBranch: string,
    log?: (text: string) => void,
  ): Promise<{
    success: boolean;
    remoteBranch: string;
    pushedCommitSha?: string;
    error?: string;
    skipped?: boolean;
  }> {
    const prefix = subRepo.prefix;
    const resolvedUrl = this.resolveRemoteUrl(subRepo.url);
    const emit = log ?? (() => {});

    try {
      emit(`git subtree push --prefix=${prefix} → ${subRepoTaskBranch}`);

      // Use git subtree split to extract the prefix history, then push
      const splitResult = await this.runProcess(
        worktreePath,
        'git',
        ['subtree', 'split', `--prefix=${prefix}`, deployCommitSha],
        CLONE_TIMEOUT_MS,
      );

      if (!splitResult.success) {
        // subtree split fails if prefix has no commits (empty subtree)
        // Try creating branch from base instead
        emit(`subtree split 失败，尝试从基准分支创建 ${subRepoTaskBranch}...`);

        const tmpParent = path.join(path.dirname(worktreePath), '.deploy-tmp');
        await mkdir(tmpParent, { recursive: true });
        const bareDir = path.join(tmpParent, `${prefix}-bare-${Date.now()}`);

        try {
          await this.mustGit(tmpParent, ['init', '--bare', bareDir]);
          await this.mustGit(bareDir, ['remote', 'add', 'origin', resolvedUrl]);
          await this.mustGitWithTimeout(
            bareDir,
            [
              'fetch',
              'origin',
              `+refs/heads/${subRepo.branch}:refs/heads/${subRepo.branch}`,
            ],
            CLONE_TIMEOUT_MS,
          );
          await this.mustGit(bareDir, [
            'push',
            'origin',
            `refs/heads/${subRepo.branch}:refs/heads/${subRepoTaskBranch}`,
          ]);
          const sha = (
            await this.mustGit(bareDir, [
              'rev-parse',
              `refs/heads/${subRepo.branch}`,
            ])
          ).stdout.trim();
          emit(`已创建远端分支 ${subRepoTaskBranch} (${sha.slice(0, 8)})`);
          return {
            success: true,
            remoteBranch: subRepoTaskBranch,
            pushedCommitSha: sha,
          };
        } finally {
          await rm(bareDir, { recursive: true, force: true }).catch(
            () => undefined,
          );
        }
      }

      const subtreeSha = splitResult.stdout.trim();
      emit(`subtree split 完成: ${subtreeSha.slice(0, 8)}`);

      // Check if remote branch already has this exact commit
      const lsResult = await this.runGit(worktreePath, [
        'ls-remote',
        resolvedUrl,
        `refs/heads/${subRepoTaskBranch}`,
      ]);
      const remoteSha = lsResult.success
        ? (lsResult.stdout.trim().split('\t')[0] ?? '')
        : '';

      if (remoteSha === subtreeSha) {
        emit('远端分支已是最新，跳过');
        return {
          success: true,
          remoteBranch: subRepoTaskBranch,
          skipped: true,
        };
      }

      // Push the subtree split result to remote (use longer timeout for network ops)
      const pushResult = await this.runProcess(
        worktreePath,
        'git',
        ['push', resolvedUrl, `${subtreeSha}:refs/heads/${subRepoTaskBranch}`],
        CLONE_TIMEOUT_MS,
      );

      if (!pushResult.success) {
        // Non-fast-forward: need to clone target branch, merge subtree SHA, then push
        if (
          pushResult.stderr?.includes('non-fast-forward') ||
          pushResult.stderr?.includes('rejected')
        ) {
          emit(`非快进推送，clone 目标分支后合并...`);

          const tmpParent = path.join(
            path.dirname(worktreePath),
            '.deploy-tmp',
          );
          await mkdir(tmpParent, { recursive: true });
          const mergeDir = path.join(
            tmpParent,
            `${prefix}-merge-${Date.now()}`,
          );

          try {
            // Clone the sub-repo's target branch directly
            await this.mustGitWithTimeout(
              tmpParent,
              [
                'clone',
                '--depth=1',
                '-b',
                subRepoTaskBranch,
                resolvedUrl,
                mergeDir,
              ],
              CLONE_TIMEOUT_MS,
            );

            // Write subtree split result as a graftable object via fetch
            // The subtree SHA exists in worktree's object store; fetch it into mergeDir
            await this.mustGit(mergeDir, ['fetch', worktreePath, subtreeSha]);

            const mergeResult = await this.runGit(mergeDir, [
              '-c',
              'user.name=AINative',
              '-c',
              'user.email=ainative@local',
              'merge',
              '--no-ff',
              '--allow-unrelated-histories',
              subtreeSha,
              '-m',
              `merge workspace changes into ${subRepoTaskBranch}`,
            ]);

            if (!mergeResult.success) {
              await this.runGit(mergeDir, ['merge', '--abort']);
              emit(`[error] 合并冲突，已回滚`);
              return {
                success: false,
                remoteBranch: subRepoTaskBranch,
                error: `合并冲突: ${mergeResult.stderr}`,
              };
            }

            const mergedSha = (
              await this.mustGit(mergeDir, ['rev-parse', 'HEAD'])
            ).stdout.trim();

            await this.mustGit(mergeDir, [
              'push',
              'origin',
              `HEAD:refs/heads/${subRepoTaskBranch}`,
            ]);

            emit(`推送成功 (merge: ${mergedSha.slice(0, 8)})`);
            return {
              success: true,
              remoteBranch: subRepoTaskBranch,
              pushedCommitSha: mergedSha,
            };
          } finally {
            await rm(mergeDir, { recursive: true, force: true }).catch(
              () => undefined,
            );
          }
        }

        // Branch doesn't exist yet — the initial push should have created it.
        // If rejected for other reasons, report error.
        emit(`[error] push 失败: ${pushResult.stderr}`);
        return {
          success: false,
          remoteBranch: subRepoTaskBranch,
          error: `push 失败: ${pushResult.stderr}`,
        };
      }

      emit(`推送成功 (${subtreeSha.slice(0, 8)})`);
      return {
        success: true,
        remoteBranch: subRepoTaskBranch,
        pushedCommitSha: subtreeSha,
      };
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : String(error);
      emit(`[error] ${errMsg}`);
      this.logger.error(
        `deploy to sub-repo failed: prefix=${prefix} branch=${subRepoTaskBranch}: ${errMsg}`,
      );
      return {
        success: false,
        remoteBranch: subRepoTaskBranch,
        error: errMsg,
      };
    }
  }

  async mergeSubRepoBranch(
    worktreePath: string,
    subRepo: SubRepoConfig,
    remoteBranch: string,
  ): Promise<{
    success: boolean;
    baseBranch: string;
    remoteBranch: string;
    error?: string;
    skipped?: boolean;
  }> {
    const prefix = subRepo.prefix;
    const resolvedUrl = this.resolveRemoteUrl(subRepo.url);

    try {
      const pullResult = await this.runGit(worktreePath, [
        '-c',
        'user.name=AINative',
        '-c',
        'user.email=ainative@local',
        'subtree',
        'pull',
        `--prefix=${prefix}`,
        resolvedUrl,
        subRepo.branch,
        '--squash',
        '-m',
        `subtree pull: merge ${subRepo.branch} into ${prefix}`,
      ]);

      if (!pullResult.success) {
        const output = pullResult.stderr + pullResult.stdout;
        if (
          output.includes('Already up to date') ||
          output.includes('up-to-date')
        ) {
          return {
            success: true,
            baseBranch: subRepo.branch,
            remoteBranch,
            skipped: true,
          };
        }

        if (output.includes('CONFLICT') || output.includes('merge conflict')) {
          await this.runGit(worktreePath, ['merge', '--abort']);
          return {
            success: false,
            baseBranch: subRepo.branch,
            remoteBranch,
            error: `合并冲突: ${output}`,
          };
        }

        return {
          success: false,
          baseBranch: subRepo.branch,
          remoteBranch,
          error: pullResult.stderr || pullResult.stdout,
        };
      }

      const alreadyUpToDate =
        pullResult.stdout.includes('Already up to date') ||
        pullResult.stderr.includes('Already up to date');

      return {
        success: true,
        baseBranch: subRepo.branch,
        remoteBranch,
        skipped: alreadyUpToDate,
      };
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : String(error);
      this.logger.error(
        `subtree pull failed: prefix=${prefix} ${subRepo.branch}: ${errMsg}`,
      );
      return {
        success: false,
        baseBranch: subRepo.branch,
        remoteBranch,
        error: errMsg,
      };
    }
  }

  async refreshSubRepoPrefixFromBranch(
    worktreePath: string,
    subRepo: SubRepoConfig,
    remoteBranch: string,
    taskBranch: string,
  ): Promise<string> {
    const resolvedUrl = this.resolveRemoteUrl(subRepo.url);
    const safeBranch = taskBranch.replace(/\//g, '--');
    const localRef = `refs/subrepo-merge/${safeBranch}/${subRepo.prefix}`;

    await this.mustGitWithTimeout(
      worktreePath,
      ['fetch', resolvedUrl, `+refs/heads/${remoteBranch}:${localRef}`],
      CLONE_TIMEOUT_MS,
    );

    await this.mustGit(worktreePath, [
      'rm',
      '-r',
      '--ignore-unmatch',
      subRepo.prefix,
    ]);

    await rm(path.join(worktreePath, subRepo.prefix), {
      recursive: true,
      force: true,
    }).catch(() => undefined);

    await this.mustGit(worktreePath, [
      'read-tree',
      `--prefix=${subRepo.prefix}/`,
      '-u',
      localRef,
    ]);

    return (
      await this.mustGit(worktreePath, ['rev-parse', localRef])
    ).stdout.trim();
  }

  // ─── Sub-repo fetch + read-tree ─────────────────────────────────────────────
  //
  // v1 boundary: fetch writes task-scoped refs under refs/subrepo-fetch/<task>/<prefix>.
  // These persist in the hidden project clone after the worktree is removed.
  // Functionally safe (no cross-task pollution), but not fully "stateless fetch".
  // Accepted trade-off for v1; revisit if true statelessness is required.

  /**
   * When every configured prefix already exists at HEAD (embedded read-tree layout), returns
   * stable tree SHAs for runner fingerprint / snapshot; otherwise null to trigger full fetch+embed.
   */
  private async tryResolveEmbeddedSubRepoHeads(
    worktreePath: string,
    subRepos: SubRepoConfig[],
  ): Promise<Record<string, string> | null> {
    if (subRepos.length === 0) {
      return {};
    }
    for (const subRepo of subRepos) {
      if (!(await this.headTreeHasPrefix(worktreePath, subRepo.prefix))) {
        return null;
      }
    }
    const heads: Record<string, string> = {};
    for (const subRepo of subRepos) {
      const treeSha = (
        await this.mustGit(worktreePath, [
          'rev-parse',
          `HEAD:${subRepo.prefix}`,
        ])
      ).stdout.trim();
      heads[subRepo.prefix] = treeSha;
    }
    return heads;
  }

  private async fetchSubRepo(
    worktreePath: string,
    subRepo: SubRepoConfig,
    refSlug: string,
  ): Promise<string> {
    const resolvedUrl = this.resolveRemoteUrl(subRepo.url);
    const fetchRef = `refs/heads/${subRepo.branch}`;
    const safeSlug = refSlug.replace(/\//g, '--');
    const localRef = `refs/subrepo-fetch/${safeSlug}/${subRepo.prefix}`;

    await this.mustGitWithTimeout(
      worktreePath,
      ['fetch', resolvedUrl, `+${fetchRef}:${localRef}`],
      CLONE_TIMEOUT_MS,
    );

    const sha = (
      await this.mustGit(worktreePath, ['rev-parse', localRef])
    ).stdout.trim();

    return sha;
  }

  /**
   * True when `rev:prefix` names a **tree** (embedded sub-repo directory), not a blob or gitlink.
   */
  private async embeddedSubRepoTreeExistsAtRevPath(
    cwd: string,
    rev: string,
    posixPath: string,
  ): Promise<boolean> {
    const spec = `${rev}:${posixPath}`;
    const verify = await this.runGit(cwd, [
      'rev-parse',
      '--verify',
      '-q',
      spec,
    ]);
    if (!verify.success) {
      return false;
    }
    const type = await this.runGit(cwd, ['cat-file', '-t', spec]);
    if (!type.success) {
      return false;
    }
    return type.stdout.trim() === 'tree';
  }

  private async headTreeHasPrefix(
    worktreePath: string,
    prefix: string,
  ): Promise<boolean> {
    return this.embeddedSubRepoTreeExistsAtRevPath(
      worktreePath,
      'HEAD',
      prefix,
    );
  }

  /** Embeds subtree at prefix; replaces existing prefix entries if already present at HEAD. */
  private async ensureSubRepoEmbedded(
    worktreePath: string,
    subRepo: SubRepoConfig,
    sha: string,
  ): Promise<void> {
    if (await this.headTreeHasPrefix(worktreePath, subRepo.prefix)) {
      await this.mustGit(worktreePath, [
        'rm',
        '-r',
        '--ignore-unmatch',
        subRepo.prefix,
      ]);
      await rm(path.join(worktreePath, subRepo.prefix), {
        recursive: true,
        force: true,
      }).catch(() => undefined);
    }

    await this.mustGit(worktreePath, [
      'read-tree',
      `--prefix=${subRepo.prefix}/`,
      '-u',
      sha,
    ]);
  }

  private async deleteSubRepoRemoteBranch(
    repositoryRoot: string,
    branch: {
      prefix: string;
      url: string;
      remoteBranch: string;
    },
    options?: { force?: boolean },
  ): Promise<{
    prefix: string;
    url: string;
    remoteBranch: string;
    deleted: boolean;
    error?: string;
    blockedByMR?: boolean;
    mrUrl?: string;
  }> {
    const resolvedUrl = this.resolveRemoteUrl(branch.url);

    if (!options?.force) {
      const mrCheck = await this.hasOpenMergeRequest(
        branch.url,
        branch.remoteBranch,
      );
      if (mrCheck.blocked) {
        return {
          prefix: branch.prefix,
          url: branch.url,
          remoteBranch: branch.remoteBranch,
          deleted: false,
          error:
            mrCheck.error ??
            'Blocked: branch has open MR. Use force=true to override.',
          blockedByMR: true,
          mrUrl: mrCheck.mrUrl,
        };
      }
    }

    try {
      const pushResult = await this.runGit(repositoryRoot, [
        'push',
        resolvedUrl,
        '--delete',
        branch.remoteBranch,
      ]);

      if (!pushResult.success) {
        if (pushResult.stderr.includes('remote ref does not exist')) {
          return {
            prefix: branch.prefix,
            url: branch.url,
            remoteBranch: branch.remoteBranch,
            deleted: true,
            error: 'Branch already deleted on remote',
          };
        }

        return {
          prefix: branch.prefix,
          url: branch.url,
          remoteBranch: branch.remoteBranch,
          deleted: false,
          error: pushResult.stderr.slice(0, 500),
        };
      }

      return {
        prefix: branch.prefix,
        url: branch.url,
        remoteBranch: branch.remoteBranch,
        deleted: true,
      };
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : String(error);
      return {
        prefix: branch.prefix,
        url: branch.url,
        remoteBranch: branch.remoteBranch,
        deleted: false,
        error: errMsg,
      };
    }
  }

  private async hasOpenMergeRequest(
    remoteUrl: string,
    sourceBranch: string,
  ): Promise<{ blocked: boolean; mrUrl?: string; error?: string }> {
    const token = this.configService.get<string>('GITLAB_TOKEN', {
      infer: true,
    });
    if (!token) {
      return {
        blocked: true,
        error:
          'Cannot verify open merge requests: GITLAB_TOKEN is not configured.',
      };
    }

    const projectPath = this.extractGitLabProjectPath(remoteUrl);
    if (!projectPath) {
      return {
        blocked: true,
        error: `Cannot verify open merge requests for ${remoteUrl}.`,
      };
    }

    const host =
      this.gitlabHttpAuthHost ||
      new URL(this.resolveRemoteUrl(remoteUrl).replace(/\/\/[^@]+@/, '//'))
        .host;
    const apiUrl = `https://${host}/api/v4/projects/${encodeURIComponent(
      projectPath,
    )}/merge_requests?state=opened&source_branch=${encodeURIComponent(
      sourceBranch,
    )}`;

    try {
      const response = await fetch(apiUrl, {
        headers: { 'PRIVATE-TOKEN': token },
      });
      if (!response.ok) {
        return {
          blocked: true,
          error: `Cannot verify open merge requests: GitLab API returned ${response.status}.`,
        };
      }

      const mrs = (await response.json()) as { web_url?: string }[];
      return {
        blocked: mrs.length > 0,
        mrUrl: mrs[0]?.web_url,
      };
    } catch (error) {
      return {
        blocked: true,
        error:
          error instanceof Error
            ? `Cannot verify open merge requests: ${error.message}`
            : 'Cannot verify open merge requests.',
      };
    }
  }

  private extractGitLabProjectPath(url: string): string | null {
    const sshMatch = url.match(/^[^@]+@[^:]+:(.+?)(?:\.git)?$/);
    if (sshMatch) return sshMatch[1];

    const httpMatch = url.match(/https?:\/\/[^/]+\/(.+?)(?:\.git)?$/);
    if (httpMatch) return httpMatch[1];

    return null;
  }

  // ─── Config helpers ─────────────────────────────────────────────────────────

  getWorkspaceGitUrl(): string {
    return (
      this.configService.get('app.workspaceGitUrl', { infer: true }) ??
      'git@gitlab.yc345.tv:frontend/ainative-workspace.git'
    );
  }

  getBaseBranch(): string {
    return (
      this.configService.get('app.workspaceBaseBranch', { infer: true }) ??
      'master'
    );
  }

  /**
   * Ensures the project long-lived branch exists on origin (from master if missing)
   * and checks out that branch in the local clone.
   */
  async ensureProjectWorkspaceBranch(
    repositoryRoot: string,
    projectBranchName: string,
  ): Promise<void> {
    const parentBranch = this.getBaseBranch();
    const normalizedBranch = projectBranchName.trim();
    if (!normalizedBranch) {
      throw new Error('Project workspace branch name is required');
    }

    await this.lockService.withLock(repositoryRoot, async () => {
      await this.mustGit(repositoryRoot, [
        'fetch',
        'origin',
        `+refs/heads/${parentBranch}:refs/remotes/origin/${parentBranch}`,
      ]);

      if (await this.originBranchExists(repositoryRoot, normalizedBranch)) {
        await this.mustGit(repositoryRoot, [
          'fetch',
          'origin',
          `+refs/heads/${normalizedBranch}:refs/remotes/origin/${normalizedBranch}`,
        ]);
      }

      const remoteRef = `refs/remotes/origin/${normalizedBranch}`;
      const remoteVerify = await this.runGit(repositoryRoot, [
        'rev-parse',
        '--verify',
        remoteRef,
      ]);

      if (!remoteVerify.success) {
        await this.mustGit(repositoryRoot, [
          'branch',
          normalizedBranch,
          `origin/${parentBranch}`,
        ]);
        await this.mustGit(repositoryRoot, [
          'push',
          '-u',
          'origin',
          normalizedBranch,
        ]);
      } else if (
        !(await this.branchExistsLocally(repositoryRoot, normalizedBranch))
      ) {
        await this.mustGit(repositoryRoot, [
          'branch',
          normalizedBranch,
          remoteRef,
        ]);
      }

      await this.mustGit(repositoryRoot, ['checkout', normalizedBranch]);
    });
  }

  /**
   * Returns a standard local path for the shared workspace repo clone.
   * Used by services that need to read workspace repo state (branches, etc.)
   * without being tied to a specific project.
   */
  getSharedRepoRoot(): string {
    const dataRoot = resolveAinativeDataRootDir();
    return path.join(dataRoot, 'workspace-repo', 'ainative-workspace');
  }

  /**
   * Ensures the shared workspace repo is cloned and fetches latest base branch.
   * Returns the repo root path.
   */
  async ensureSharedRepoReady(): Promise<string> {
    const repoRoot = this.getSharedRepoRoot();
    await this.ensureClone(repoRoot);
    return repoRoot;
  }

  private getResolvedWorkspaceGitUrl(): string {
    return this.resolveRemoteUrl(this.getWorkspaceGitUrl());
  }

  // ─── Git helpers ────────────────────────────────────────────────────────────

  /** Local `refs/heads/<name>` only (no `origin/` fallback). Used for materialized task worktrees without fetch. */
  private async resolveLocalBranchRefOnly(
    repositoryRoot: string,
    branchName: string,
  ): Promise<string> {
    const local = await this.runGit(repositoryRoot, [
      'rev-parse',
      '--verify',
      `refs/heads/${branchName}`,
    ]);
    if (local.success) {
      return `refs/heads/${branchName}`;
    }

    throw new Error(
      `基准分支「${branchName}」未在本地仓库中存在，请先检出或创建该分支后再创建任务（请确保功能组分支已在本地存在）。`,
    );
  }

  private async resolveBranchRefForRevParse(
    repositoryRoot: string,
    branchName: string,
  ): Promise<string> {
    const local = await this.runGit(repositoryRoot, [
      'rev-parse',
      '--verify',
      `refs/heads/${branchName}`,
    ]);
    if (local.success) {
      return `refs/heads/${branchName}`;
    }

    const remote = await this.runGit(repositoryRoot, [
      'rev-parse',
      '--verify',
      `refs/remotes/origin/${branchName}`,
    ]);
    if (remote.success) {
      return `refs/remotes/origin/${branchName}`;
    }

    throw new Error(
      `Branch '${branchName}' not found locally or under origin.`,
    );
  }

  private async branchExistsLocally(
    cwd: string,
    branch: string,
  ): Promise<boolean> {
    const result = await this.runGit(cwd, [
      'rev-parse',
      '--verify',
      `refs/heads/${branch}`,
    ]);
    return result.success;
  }

  private async remoteBranchExists(
    cwd: string,
    remoteUrl: string,
    branch: string,
  ): Promise<boolean> {
    const result = await this.runGit(cwd, [
      'ls-remote',
      '--heads',
      remoteUrl,
      branch,
    ]);
    return result.success && result.stdout.trim().length > 0;
  }

  private async originBranchExists(
    cwd: string,
    branch: string,
  ): Promise<boolean> {
    const result = await this.runGit(cwd, [
      'ls-remote',
      '--heads',
      'origin',
      `refs/heads/${branch}`,
    ]);
    return result.success && result.stdout.trim().length > 0;
  }

  private async countTrackedFiles(cwd: string): Promise<number> {
    const result = await this.mustGit(cwd, ['ls-files']);
    return result.stdout.split('\n').filter(Boolean).length;
  }

  private async countFiles(directory: string): Promise<number> {
    let count = 0;
    const entries = await readdir(directory, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(directory, entry.name);
      if (entry.name === '.git') continue;

      if (entry.isDirectory()) {
        count += await this.countFiles(fullPath);
      } else if (entry.isFile()) {
        count += 1;
      } else if (entry.isSymbolicLink()) {
        const linkStat = await stat(fullPath).catch(() => null);
        if (linkStat?.isFile()) {
          count += 1;
        }
      }
    }

    return count;
  }

  private assertSafeDeployDiff(
    statusOutput: string,
    trackedFileCount: number,
    exportedFileCount: number,
    prefix: string,
  ): void {
    const lines = statusOutput.split('\n').filter(Boolean);
    const deletedCount = lines.filter((line) => {
      const status = line.slice(0, 2);
      return status.includes('D');
    }).length;

    const isMassDelete =
      trackedFileCount > 0 &&
      deletedCount >= MASS_DELETE_MIN_FILE_COUNT &&
      deletedCount / trackedFileCount >= MASS_DELETE_RATIO_LIMIT;

    if (isMassDelete) {
      throw new Error(
        `Refusing to deploy '${prefix}/': exported snapshot has ${exportedFileCount} files but would delete ${deletedCount}/${trackedFileCount} tracked files. Check workspace .gitignore and committed files before retrying.`,
      );
    }
  }

  private async mustGit(
    cwd: string,
    args: string[],
  ): Promise<{ stdout: string; stderr: string }> {
    const result = await this.runGit(cwd, args);
    if (!result.success) {
      throw new Error(
        `git ${args[0]} failed (cwd=${cwd}): ${this.sanitizeLogOutput(result.stderr).slice(0, 500)}`,
      );
    }
    return result;
  }

  private async mustGitWithTimeout(
    cwd: string,
    args: string[],
    timeoutMs: number,
  ): Promise<{ stdout: string; stderr: string }> {
    const result = await this.runProcess(cwd, 'git', args, timeoutMs);
    if (!result.success) {
      throw new Error(
        `git ${args[0]} failed (cwd=${cwd}): ${this.sanitizeLogOutput(result.stderr).slice(0, 500)}`,
      );
    }
    return result;
  }

  private async mustExec(
    cwd: string,
    command: string,
    args: string[],
  ): Promise<{ stdout: string; stderr: string }> {
    const result = await this.runProcess(cwd, command, args, this.gitTimeoutMs);
    if (!result.success) {
      throw new Error(
        `${command} ${args[0] ?? ''} failed (cwd=${cwd}): ${result.stderr.slice(0, 500)}`,
      );
    }
    return result;
  }

  /**
   * Pipe stdout of cmd1 into stdin of cmd2.
   * Used for `git archive | tar -x` to export a specific commit snapshot.
   */
  private mustExecPipe(
    cwd: string,
    cmd1: string,
    args1: string[],
    cmd2: string,
    args2: string[],
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      const proc1 = spawn(cmd1, args1, {
        cwd,
        stdio: ['ignore', 'pipe', 'pipe'],
        env: { ...process.env, GIT_TERMINAL_PROMPT: '0' },
      });
      const proc2 = spawn(cmd2, args2, {
        stdio: ['pipe', 'ignore', 'pipe'],
        env: process.env,
      });

      proc1.stdout.pipe(proc2.stdin);

      let stderr1 = '';
      let stderr2 = '';
      proc1.stderr.on('data', (d: Buffer) => {
        stderr1 += d.toString();
      });
      proc2.stderr.on('data', (d: Buffer) => {
        stderr2 += d.toString();
      });

      let resolved = false;
      const done = (err?: Error) => {
        if (resolved) return;
        resolved = true;
        if (err) reject(err);
        else resolve();
      };

      proc1.on('error', (e) =>
        done(new Error(`${cmd1} spawn error: ${e.message}`)),
      );
      proc2.on('error', (e) =>
        done(new Error(`${cmd2} spawn error: ${e.message}`)),
      );

      proc1.on('close', (code) => {
        if (code !== 0) {
          done(
            new Error(
              `${cmd1} exited with code ${code}: ${stderr1.slice(0, 300)}`,
            ),
          );
          proc2.kill();
        }
      });

      proc2.on('close', (code) => {
        if (code !== 0) {
          done(
            new Error(
              `${cmd2} exited with code ${code}: ${stderr2.slice(0, 300)}`,
            ),
          );
        } else {
          done();
        }
      });
    });
  }

  private runGit(
    cwd: string,
    args: string[],
  ): Promise<{ success: boolean; stdout: string; stderr: string }> {
    return this.runProcess(cwd, 'git', args, this.gitTimeoutMs);
  }

  private runProcess(
    cwd: string,
    command: string,
    args: string[],
    timeoutMs: number,
  ): Promise<{ success: boolean; stdout: string; stderr: string }> {
    return new Promise((resolve) => {
      const proc = spawn(command, args, {
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
        setTimeout(() => proc.kill('SIGKILL'), 5_000);
        resolve({
          success: false,
          stdout: stdout.trimEnd(),
          stderr: `Process timed out after ${timeoutMs}ms. ${stderr.trimEnd()}`,
        });
      }, timeoutMs);

      proc.on('error', (error) => {
        clearTimeout(timeoutRef);
        resolve({
          success: false,
          stdout: stdout.trimEnd(),
          stderr: error.message,
        });
      });

      proc.on('close', (code) => {
        clearTimeout(timeoutRef);
        const result = {
          success: code === 0,
          stdout: stdout.trimEnd(),
          stderr: stderr.trimEnd(),
        };
        if (!result.success && command === 'git') {
          this.logger.debug(
            `git ${args[0]} failed (cwd=${cwd}): ${this.sanitizeLogOutput(result.stderr).slice(0, 200)}`,
          );
        }
        resolve(result);
      });
    });
  }

  private resolveRemoteUrl(url: string): string {
    return resolveGitRemoteUrlWithHttpAuth(url, {
      targetHost: this.gitlabHttpAuthHost,
      username:
        this.configService.get<string>('GITLAB_USERNAME', { infer: true }) ??
        'oauth2',
      token: this.configService.get<string>('GITLAB_TOKEN', { infer: true }),
    });
  }

  private sanitizeLogOutput(output: string): string {
    return output.replace(/https?:\/\/[^@]+@/g, 'https://***@');
  }

  private async pathExists(p: string): Promise<boolean> {
    try {
      await access(p);
      return true;
    } catch {
      return false;
    }
  }
}
