import { BadRequestException, Injectable } from '@nestjs/common';
import { spawn } from 'child_process';
import { GitBranchActionResultDto } from './dto/git-branch-action-result.dto';
import { GitBranchesDto } from './dto/git-branches.dto';
import {
  GitBranchDetailDto,
  GitBranchesDetailDto,
} from './dto/git-branches-detail.dto';
import { GitLogDto } from './dto/git-log.dto';
import { GitPullMainDto } from './dto/git-pull-main.dto';
import { GitStatusDto } from './dto/git-status.dto';
import { JwtPayloadType } from '../auth/strategies/types/jwt-payload.type';
import { ProjectsService } from '../projects/projects.service';

@Injectable()
export class GitService {
  private readonly defaultGitTimeoutMs = 60_000;
  private readonly fallbackDefaultBranch = 'main';

  constructor(private readonly projectsService: ProjectsService) {}

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

  private async resolveProjectContext(
    projectId: string,
    currentUser: JwtPayloadType,
    options: { syncRemote?: boolean } = {},
  ): Promise<{ repositoryRoot: string; defaultBranch: string }> {
    const { project, repositoryRoot } =
      await this.projectsService.ensureProjectRepositoryReady(
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
