import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'crypto';
import { mkdtemp, rm, readdir, mkdir } from 'fs/promises';
import { tmpdir } from 'os';
import path from 'path';
import { spawn } from 'child_process';

import { SubRepoConfig } from './sub-repo.types';
import { ProjectGitLockService } from './project-git-lock.service';
import { ProjectGitStateRepository } from '../projects/project-git-state.repository';
import {
  DeployStatus,
  SubtreeSyncResult,
  SubtreeOperationLog,
} from './snapshot-sync.types';
import {
  assertSafePrefix,
  assertCleanWorkingTree,
} from './snapshot-sync-guards.util';
import {
  removeManagedBlock,
  writeManagedBlock,
} from './gitignore-managed-block.util';
import { resolveGitRemoteUrlWithHttpAuth } from './git-remote-auth.util';

const DEFAULT_CLONE_TIMEOUT_MS = 120_000;

@Injectable()
export class SubtreeSnapshotService {
  private readonly logger = new Logger(SubtreeSnapshotService.name);
  private readonly cloneTimeoutMs: number;
  private readonly gitlabHttpAuthHost: string;

  constructor(
    private readonly gitLockService: ProjectGitLockService,
    private readonly gitStateRepository: ProjectGitStateRepository,
    private readonly configService: ConfigService,
  ) {
    this.cloneTimeoutMs =
      this.configService.get<number>('SUBTREE_CLONE_TIMEOUT_MS', {
        infer: true,
      }) ?? DEFAULT_CLONE_TIMEOUT_MS;
    this.gitlabHttpAuthHost =
      this.configService.get<string>('GITLAB_HTTP_AUTH_HOST', {
        infer: true,
      }) ?? '';
  }

  // ─── syncSubtreeSnapshots ─────────────────────────────────────────────────

  /**
   * 从子仓 remote 拉最新内容，覆盖到主仓 prefix 目录并 commit。
   *
   * 部分子仓失败策略：任一失败，整个 sync 失败，不 commit，不进入 snapshot_synced。
   */
  async syncSubtreeSnapshots(
    projectId: string,
    repositoryRoot: string,
    subtreeConfigs: SubRepoConfig[],
  ): Promise<SubtreeSyncResult[]> {
    if (subtreeConfigs.length === 0) return [];

    for (const config of subtreeConfigs) {
      assertSafePrefix(config.prefix);
    }

    const results: SubtreeSyncResult[] = [];
    const startTime = Date.now();

    // Phase 1: clone all sub-repos to temp dirs FIRST (no repo mutation yet)
    const clonedTemps: Array<{ config: SubRepoConfig; tmpDir: string }> = [];
    let allCloneSuccess = true;
    for (const config of subtreeConfigs) {
      const itemStart = Date.now();
      try {
        const tmpDir = await this.cloneSubtreeToTemp(config);
        clonedTemps.push({ config, tmpDir });
        results.push({
          prefix: config.prefix,
          synced: true,
          durationMs: Date.now() - itemStart,
        });
      } catch (error) {
        const errMsg = error instanceof Error ? error.message : String(error);
        this.logger.error(
          `[${projectId}] clone failed for prefix=${config.prefix}: ${errMsg}`,
        );
        results.push({
          prefix: config.prefix,
          synced: false,
          error: errMsg,
          durationMs: Date.now() - itemStart,
        });
        allCloneSuccess = false;
      }
    }

    // If any clone failed, clean up temps and bail — repo stays untouched
    if (!allCloneSuccess) {
      for (const { tmpDir } of clonedTemps) {
        await rm(tmpDir, { recursive: true, force: true }).catch(() => {});
      }
      await this.gitStateRepository.setLastError(
        projectId,
        `Sync failed: ${results
          .filter((r) => r.error)
          .map((r) => `${r.prefix}: ${r.error}`)
          .join('; ')}`,
      );
      return results;
    }

    // Phase 2: all clones succeeded — now mutate the working tree
    // Stash the current HEAD so we can hard-reset on failure
    const headBeforeResult = await this.mustGit(repositoryRoot, [
      'rev-parse',
      'HEAD',
    ]);
    const headBefore = headBeforeResult.stdout.trim();

    try {
      const gitignorePath = path.join(repositoryRoot, '.gitignore');
      await removeManagedBlock(gitignorePath);

      for (const { config, tmpDir } of clonedTemps) {
        const targetDir = path.join(repositoryRoot, config.prefix);
        await this.mustExec(repositoryRoot, 'mkdir', ['-p', targetDir]);
        await this.mustExec(repositoryRoot, 'rsync', [
          '-a',
          '--delete',
          '--exclude=.git',
          `${tmpDir}/`,
          `${targetDir}/`,
        ]);
      }

      const pathspecs = [
        '--',
        '.gitignore',
        ...subtreeConfigs.map((c) => `${c.prefix}/`),
      ];
      await this.mustGit(repositoryRoot, ['add', '-A', ...pathspecs]);

      const statusOutput = await this.mustGit(repositoryRoot, [
        'status',
        '--porcelain',
      ]);

      let snapshotEpoch: string | undefined;
      const currentState = await this.gitStateRepository.getState(projectId);

      if (statusOutput.stdout.trim()) {
        await this.mustGit(repositoryRoot, [
          'commit',
          '-m',
          'sync: subtree snapshot',
        ]);
        snapshotEpoch = randomUUID();
        await this.gitStateRepository.setSnapshotEpoch(
          projectId,
          snapshotEpoch,
        );
      } else {
        if (!currentState.snapshotEpoch) {
          snapshotEpoch = randomUUID();
          await this.gitStateRepository.setSnapshotEpoch(
            projectId,
            snapshotEpoch,
          );
        }
        results.forEach((r) => {
          if (r.synced) {
            r.synced = false;
            r.skippedReason = 'no_changes';
          }
        });
      }

      await this.gitStateRepository.transitionPhase(
        projectId,
        currentState.gitPhase === 'idle' ? 'idle' : currentState.gitPhase,
        'snapshot_synced',
      );

      this.logOperation({
        projectId,
        operationType: 'sync_snapshot',
        phaseBefore: currentState.gitPhase,
        phaseAfter: 'snapshot_synced',
        snapshotEpoch: snapshotEpoch ?? currentState.snapshotEpoch,
        success: true,
        durationMs: Date.now() - startTime,
        timestamp: new Date().toISOString(),
      });

      return results;
    } catch (error) {
      // Phase 2 failed mid-rsync/commit: hard-reset to pre-sync state
      this.logger.error(
        `[${projectId}] sync phase-2 failed, rolling back to ${headBefore}: ${error}`,
      );
      await this.git(repositoryRoot, ['reset', '--hard', headBefore]);
      await this.git(repositoryRoot, ['clean', '-fd']);

      await this.gitStateRepository.setLastError(
        projectId,
        `Sync rollback: ${error instanceof Error ? error.message : String(error)}`,
      );

      throw error;
    } finally {
      for (const { tmpDir } of clonedTemps) {
        await rm(tmpDir, { recursive: true, force: true }).catch(() => {});
      }
    }
  }

  // ─── snapshotPushToSubRepo ────────────────────────────────────────────────

  /**
   * 目录快照推送：从 deployCommitSha 导出 prefix 内容到子仓 remote。
   * 不使用 git subtree push，改用 archive + rsync + push。
   */
  async snapshotPushToSubRepo(
    repositoryRoot: string,
    deployCommitSha: string,
    prefix: string,
    remoteUrl: string,
    targetBranch: string,
    options?: { forceWithLease?: boolean; expectedRemoteSha?: string },
  ): Promise<{
    success: boolean;
    skipped?: boolean;
    skippedReason?: 'no_changes';
    error?: string;
  }> {
    assertSafePrefix(prefix);
    const resolvedUrl = this.resolveRemoteUrl(remoteUrl);
    const tmpBase = path.join(tmpdir(), 'snapshot-push');
    await mkdir(tmpBase, { recursive: true });
    const exportDir = await mkdtemp(
      path.join(tmpBase, `${prefix.replace(/\//g, '_')}-export-`),
    );
    const cloneDir = await mkdtemp(
      path.join(tmpBase, `${prefix.replace(/\//g, '_')}-clone-`),
    );

    try {
      await this.mustGit(
        repositoryRoot,
        ['archive', deployCommitSha, '--', `${prefix}/`],
        { pipe: { to: exportDir, stripPrefix: prefix } },
      );

      const exportedFiles = await readdir(exportDir);
      if (exportedFiles.length === 0) {
        return { success: true, skipped: true, skippedReason: 'no_changes' };
      }

      await this.mustGitWithTimeout(
        cloneDir,
        ['clone', '--depth=1', '-b', targetBranch, resolvedUrl, cloneDir],
        this.cloneTimeoutMs,
        { isInit: true },
      );

      await this.mustExec(cloneDir, 'rsync', [
        '-a',
        '--delete',
        '--exclude=.git',
        `${exportDir}/`,
        `${cloneDir}/`,
      ]);

      const statusResult = await this.mustGit(cloneDir, [
        'status',
        '--porcelain',
      ]);

      if (!statusResult.stdout.trim()) {
        return { success: true, skipped: true, skippedReason: 'no_changes' };
      }

      await this.mustGit(cloneDir, ['add', '-A']);
      await this.mustGit(cloneDir, [
        'commit',
        '-m',
        `deploy: snapshot from ${deployCommitSha.slice(0, 8)} (${prefix})`,
      ]);

      const pushArgs = ['push', 'origin', `HEAD:${targetBranch}`];
      if (options?.forceWithLease && options.expectedRemoteSha) {
        pushArgs.splice(
          1,
          0,
          `--force-with-lease=refs/heads/${targetBranch}:${options.expectedRemoteSha}`,
        );
      }
      await this.mustGit(cloneDir, pushArgs);

      return { success: true };
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : String(error);
      return { success: false, error: errMsg };
    } finally {
      await rm(exportDir, { recursive: true, force: true }).catch(() => {});
      await rm(cloneDir, { recursive: true, force: true }).catch(() => {});
    }
  }

  // ─── untrackAndPushMainRepo ───────────────────────────────────────────────

  /**
   * 部署完成后：untrack 子仓目录 + push 主仓。
   *
   * 安全检查（硬校验）：
   * 1. 所有 subtree 状态必须是 success 或 skipped
   * 2. repositoryRoot 必须 clean
   * 3. 当前 HEAD 等于 deployCommitSha
   */
  async untrackAndPushMainRepo(
    projectId: string,
    repositoryRoot: string,
    subtreeConfigs: SubRepoConfig[],
    deployStatus: DeployStatus,
    remote: string,
    branch: string,
  ): Promise<void> {
    const incompleteSubtrees = deployStatus.subtrees.filter(
      (s) => s.status !== 'success' && s.status !== 'skipped',
    );
    if (incompleteSubtrees.length > 0) {
      throw new Error(
        `Cannot untrack: subtrees not all success/skipped: ${incompleteSubtrees.map((s) => `${s.prefix}:${s.status}`).join(', ')}`,
      );
    }

    await assertCleanWorkingTree(repositoryRoot);

    const headResult = await this.mustGit(repositoryRoot, [
      'rev-parse',
      'HEAD',
    ]);
    const currentHead = headResult.stdout.trim();
    if (
      deployStatus.deployCommitSha &&
      currentHead !== deployStatus.deployCommitSha
    ) {
      throw new Error(
        `HEAD mismatch: expected ${deployStatus.deployCommitSha}, got ${currentHead}. Repository may have been modified externally.`,
      );
    }

    const prefixes = subtreeConfigs.map((c) => c.prefix);
    const gitignorePath = path.join(repositoryRoot, '.gitignore');
    await writeManagedBlock(gitignorePath, prefixes);

    for (const config of subtreeConfigs) {
      const lsResult = await this.mustGit(repositoryRoot, [
        'ls-files',
        `${config.prefix}/`,
      ]);
      if (lsResult.stdout.trim()) {
        await this.mustGit(repositoryRoot, [
          'rm',
          '-r',
          '--cached',
          '--ignore-unmatch',
          `${config.prefix}/`,
        ]);
      }
    }

    await this.mustGit(repositoryRoot, ['add', '-A', '--', '.gitignore']);
    await this.mustGit(repositoryRoot, [
      'commit',
      '-m',
      'chore: untrack subtree dirs for push',
    ]);

    await this.mustGit(repositoryRoot, ['push', remote, `HEAD:${branch}`]);

    const cleanupHeadResult = await this.mustGit(repositoryRoot, [
      'rev-parse',
      'HEAD',
    ]);
    const cleanupCommitSha = cleanupHeadResult.stdout.trim();

    const updatedDeployStatus: DeployStatus = {
      ...deployStatus,
      cleanupCommitSha,
      mainRepoPushed: true,
      updatedAt: new Date().toISOString(),
    };

    await this.gitStateRepository.setDeployStatus(
      projectId,
      updatedDeployStatus,
    );

    const currentPhase = await this.gitStateRepository.getPhase(projectId);
    await this.gitStateRepository.transitionPhase(
      projectId,
      currentPhase,
      'idle',
    );

    await this.gitStateRepository.setActiveTask(projectId, undefined);

    this.logOperation({
      projectId,
      operationType: 'untrack_cleanup',
      phaseBefore: currentPhase,
      phaseAfter: 'idle',
      deployCommitSha: deployStatus.deployCommitSha,
      cleanupCommitSha,
      success: true,
      timestamp: new Date().toISOString(),
    });
  }

  // ─── Private helpers ──────────────────────────────────────────────────────

  /**
   * Clone a sub-repo to a temp directory. Caller is responsible for cleanup.
   * Returns the temp dir path (with cloned content).
   */
  private async cloneSubtreeToTemp(config: SubRepoConfig): Promise<string> {
    const resolvedUrl = this.resolveRemoteUrl(config.url);
    const tmpDir = await mkdtemp(
      path.join(
        tmpdir(),
        `snapshot-sync-${config.prefix.replace(/\//g, '_')}-`,
      ),
    );

    try {
      await this.mustGitWithTimeout(
        tmpDir,
        ['clone', '--depth=1', '-b', config.branch, resolvedUrl, tmpDir],
        this.cloneTimeoutMs,
        { isInit: true },
      );

      const files = await readdir(tmpDir);
      const nonGitFiles = files.filter((f) => f !== '.git');
      if (nonGitFiles.length === 0) {
        throw new Error(
          `Sub-repo at ${config.url} branch=${config.branch} is empty (no files besides .git)`,
        );
      }

      return tmpDir;
    } catch (error) {
      await rm(tmpDir, { recursive: true, force: true }).catch(() => {});
      throw error;
    }
  }

  private async git(
    cwd: string,
    args: string[],
    options?: { pipe?: { to: string; stripPrefix: string } },
  ): Promise<{ success: boolean; stdout: string; stderr: string }> {
    if (options?.pipe) {
      return this.gitArchiveExtract(
        cwd,
        args,
        options.pipe.to,
        options.pipe.stripPrefix,
      );
    }
    return this.runProcess(cwd, 'git', args, this.cloneTimeoutMs);
  }

  /**
   * Like git() but throws on failure. Use for all commands where failure
   * must abort the current operation.
   */
  private async mustGit(
    cwd: string,
    args: string[],
    options?: { pipe?: { to: string; stripPrefix: string } },
  ): Promise<{ stdout: string; stderr: string }> {
    const result = await this.git(cwd, args, options);
    if (!result.success) {
      throw new Error(
        `git ${args[0]} failed (cwd=${cwd}): ${result.stderr.slice(0, 500)}`,
      );
    }
    return result;
  }

  /**
   * Like exec() but throws on failure.
   */
  private async mustExec(
    cwd: string,
    command: string,
    args: string[],
  ): Promise<{ stdout: string; stderr: string }> {
    const result = await this.exec(cwd, command, args);
    if (!result.success) {
      throw new Error(
        `${command} ${args[0] ?? ''} failed (cwd=${cwd}): ${result.stderr.slice(0, 500)}`,
      );
    }
    return result;
  }

  private async gitWithTimeout(
    cwd: string,
    args: string[],
    timeoutMs: number,
    options?: { isInit?: boolean },
  ): Promise<{ success: boolean; stdout: string; stderr: string }> {
    const effectiveCwd = options?.isInit ? path.dirname(cwd) : cwd;
    return this.runProcess(effectiveCwd, 'git', args, timeoutMs);
  }

  /**
   * Like gitWithTimeout() but throws on failure.
   */
  private async mustGitWithTimeout(
    cwd: string,
    args: string[],
    timeoutMs: number,
    options?: { isInit?: boolean },
  ): Promise<{ stdout: string; stderr: string }> {
    const result = await this.gitWithTimeout(cwd, args, timeoutMs, options);
    if (!result.success) {
      throw new Error(
        `git ${args[0]} failed (cwd=${cwd}): ${result.stderr.slice(0, 500)}`,
      );
    }
    return result;
  }

  private async gitArchiveExtract(
    cwd: string,
    archiveArgs: string[],
    targetDir: string,
    stripPrefix: string,
  ): Promise<{ success: boolean; stdout: string; stderr: string }> {
    const stripComponents = stripPrefix.split('/').filter(Boolean).length;
    const archiveResult = await this.runProcess(
      cwd,
      'git',
      archiveArgs,
      this.cloneTimeoutMs,
    );
    if (!archiveResult.success) {
      return archiveResult;
    }

    await this.exec(cwd, 'mkdir', ['-p', targetDir]);

    return new Promise((resolve) => {
      const gitArchive = spawn('git', ['archive', ...archiveArgs.slice(1)], {
        cwd,
        stdio: ['ignore', 'pipe', 'pipe'],
      });
      const tarExtract = spawn(
        'tar',
        ['-x', `--strip-components=${stripComponents}`, '-C', targetDir],
        { stdio: ['pipe', 'pipe', 'pipe'] },
      );

      gitArchive.stdout.pipe(tarExtract.stdin);

      let stderr = '';
      tarExtract.stderr.on('data', (d) => {
        stderr += d.toString();
      });
      gitArchive.stderr.on('data', (d) => {
        stderr += d.toString();
      });

      tarExtract.on('close', (code) => {
        resolve({ success: code === 0, stdout: '', stderr });
      });
      tarExtract.on('error', (err) => {
        resolve({ success: false, stdout: '', stderr: err.message });
      });
    });
  }

  private async exec(
    cwd: string,
    command: string,
    args: string[],
  ): Promise<{ success: boolean; stdout: string; stderr: string }> {
    return this.runProcess(cwd, command, args, this.cloneTimeoutMs);
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

      proc.stdout?.on('data', (chunk) => {
        stdout += chunk.toString('utf-8');
      });
      proc.stderr?.on('data', (chunk) => {
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
            `git ${args[0]} failed (cwd=${cwd}): ${result.stderr.slice(0, 200)}`,
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

  private logOperation(log: Partial<SubtreeOperationLog>): void {
    this.logger.log({
      msg: 'subtree_operation',
      ...log,
    });
  }
}
