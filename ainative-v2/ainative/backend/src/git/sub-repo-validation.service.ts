import { BadRequestException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { spawn } from 'child_process';
import { resolveGitRemoteUrlWithHttpAuth } from './git-remote-auth.util';
import { SubRepoConfig, validateSubRepoConfigs } from './sub-repo.types';

const DEFAULT_VALIDATE_TIMEOUT_MS = 120_000;

@Injectable()
export class SubRepoValidationService {
  private readonly gitlabHttpAuthHost: string;

  constructor(private readonly configService: ConfigService) {
    this.gitlabHttpAuthHost =
      this.configService.get<string>('GITLAB_HTTP_AUTH_HOST', {
        infer: true,
      }) ?? 'gitlab.yc345.tv';
  }

  async validateConfiguredSubRepositories(
    configJson: Record<string, unknown> | null | undefined,
  ): Promise<SubRepoConfig[]> {
    let subRepos: SubRepoConfig[];
    try {
      subRepos = validateSubRepoConfigs(configJson);
    } catch (error) {
      throw new BadRequestException(
        error instanceof Error
          ? error.message
          : 'Invalid sub repository config',
      );
    }

    for (const sub of subRepos) {
      await this.validateSubRepositoryBranchAccessible(sub);
    }

    return subRepos;
  }

  async validateSubRepositoryBranchAccessible(
    sub: SubRepoConfig,
  ): Promise<void> {
    const resolvedGitUrl = this.resolveGitRemoteUrl(sub.url);

    const result = await this.runCommand('git', [
      'ls-remote',
      '--heads',
      '--exit-code',
      resolvedGitUrl,
      sub.branch,
    ]);

    if (result.success) {
      return;
    }

    throw new BadRequestException(
      `Sub repository branch is unreachable or does not exist: ${sub.prefix}@${sub.branch}: ${this.truncateError(
        result.stderr,
      )}`,
    );
  }

  private resolveGitRemoteUrl(gitUrl: string): string {
    return resolveGitRemoteUrlWithHttpAuth(gitUrl, {
      targetHost: this.gitlabHttpAuthHost,
      username:
        this.configService.get<string>('GITLAB_USERNAME', { infer: true }) ??
        'oauth2',
      token: this.configService.get<string>('GITLAB_TOKEN', { infer: true }),
    });
  }

  private truncateError(value: string, maxLength = 500): string {
    const text = value.trim();
    return text.length > maxLength ? `${text.slice(0, maxLength)}...` : text;
  }

  private runCommand(
    command: string,
    args: string[],
  ): Promise<{ success: boolean; stdout: string; stderr: string }> {
    return new Promise((resolve) => {
      const child = spawn(command, args, {
        stdio: ['ignore', 'pipe', 'pipe'],
        env: {
          ...process.env,
          GIT_TERMINAL_PROMPT: '0',
        },
      });

      let stdout = '';
      let stderr = '';
      let finished = false;

      const finish = (result: {
        success: boolean;
        stdout: string;
        stderr: string;
      }) => {
        if (finished) return;
        finished = true;
        clearTimeout(timeout);
        resolve(result);
      };

      const timeout = setTimeout(() => {
        child.kill('SIGTERM');
        finish({
          success: false,
          stdout: stdout.trimEnd(),
          stderr: `Timed out after ${DEFAULT_VALIDATE_TIMEOUT_MS}ms. ${stderr.trimEnd()}`,
        });
      }, DEFAULT_VALIDATE_TIMEOUT_MS);

      child.stdout.on('data', (data: Buffer) => {
        stdout += data.toString();
      });
      child.stderr.on('data', (data: Buffer) => {
        stderr += data.toString();
      });

      child.on('close', (code) => {
        finish({
          success: code === 0,
          stdout: stdout.trimEnd(),
          stderr: stderr.trimEnd(),
        });
      });

      child.on('error', (err) => {
        finish({
          success: false,
          stdout: '',
          stderr: err.message,
        });
      });
    });
  }
}
