import { BadRequestException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import os from 'os';
import { AgentCliAdapterRegistry } from './agent-cli/agent-cli-adapter.registry';
import {
  AgentCliAdapterId,
  AgentCliRunnerConfigInput,
} from './agent-cli/agent-cli-adapter.interface';
import { sanitizeAgentToolConfigJson } from './agent-cli-sanitize-config';
import { LocalProcessLauncherService } from './local-process-launcher.service';

export type AgentCliSmokeErrorCode =
  | 'ENOENT'
  | 'TIMEOUT'
  | 'NON_ZERO'
  | 'SPAWN_ERROR'
  | 'AUTH_ERROR';

export type AgentCliSmokeTestResult = {
  ok: boolean;
  exitCode: number | null;
  command: string;
  args: string[];
  stdoutPreview?: string;
  stderrPreview?: string;
  errorCode?: AgentCliSmokeErrorCode;
};

/** Minimal English prompt: one model turn, easy to verify failure via exit / stderr. */
export const E2E_PROBE_USER_MESSAGE =
  'Reply with exactly the single word: OK. Do not add any other characters or punctuation.';

const DEFAULT_SMOKE_TIMEOUT_MS = 120_000;
const MAX_SMOKE_TIMEOUT_MS = 600_000;
const STREAM_PREVIEW_MAX_CHARS = 800;

@Injectable()
export class AgentCliSmokeTestService {
  constructor(
    private readonly configService: ConfigService,
    private readonly agentCliAdapterRegistry: AgentCliAdapterRegistry,
    private readonly localProcessLauncher: LocalProcessLauncherService,
  ) {}

  /**
   * Environment used when probing MCP servers so it matches real control-plane runs
   * (see {@link runSmokeTest} and {@link ControlPlaneAgentExecutionService.buildLocalEnvironment}).
   */
  buildProbeEnvironmentForAgentToolConfig(params: {
    toolId: string;
    configJson: Record<string, unknown>;
  }): NodeJS.ProcessEnv {
    const adapter = this.agentCliAdapterRegistry.resolve(params.toolId);
    if (!adapter) {
      throw new BadRequestException('Unsupported agent CLI tool id');
    }

    const sanitized = sanitizeAgentToolConfigJson(
      this.agentCliAdapterRegistry,
      adapter,
      params.configJson,
    );

    const cliAdapter = this.agentCliAdapterRegistry.getById(adapter);
    const runnerConfig = cliAdapter.buildToolRunnerConfig(sanitized);

    return this.buildLocalEnvironment(this.resolveRunnerEnv(runnerConfig));
  }

  resolveLocalMcpProbeTimeoutMs(): number {
    const raw = this.configService
      .get<string>('AINATIVE_LOCAL_MCP_PROBE_TIMEOUT_MS', { infer: true })
      ?.trim();
    if (raw) {
      const n = Number.parseInt(raw, 10);
      if (Number.isFinite(n) && n > 0) {
        return Math.min(n, MAX_SMOKE_TIMEOUT_MS);
      }
    }

    return this.resolveSmokeTestTimeoutMs();
  }

  async runSmokeTest(params: {
    toolId: string;
    configJson: Record<string, unknown>;
  }): Promise<AgentCliSmokeTestResult> {
    const adapter = this.agentCliAdapterRegistry.resolve(params.toolId);
    if (!adapter) {
      throw new BadRequestException('Unsupported agent CLI tool id');
    }

    let sanitized = sanitizeAgentToolConfigJson(
      this.agentCliAdapterRegistry,
      adapter,
      params.configJson,
    );

    if (adapter === 'opencode') {
      sanitized = {
        ...sanitized,
        prompt: E2E_PROBE_USER_MESSAGE,
      };
    }

    const cliAdapter = this.agentCliAdapterRegistry.getById(adapter);
    const runnerConfig = cliAdapter.buildToolRunnerConfig(sanitized);

    const command = this.resolveCommand(adapter, runnerConfig);
    const baseArgs = runnerConfig.args ?? cliAdapter.defaultArgs();
    const finalArgs = cliAdapter.normalizeArgs([...baseArgs]);

    const mergedEnv = this.buildLocalEnvironment(
      this.resolveRunnerEnv(runnerConfig),
    );

    const timeoutMs = this.resolveSmokeTestTimeoutMs();

    const spawnArgs =
      adapter === 'cursor' ? [...finalArgs, E2E_PROBE_USER_MESSAGE] : finalArgs;

    const writeStdin =
      adapter === 'cursor' || adapter === 'opencode'
        ? null
        : E2E_PROBE_USER_MESSAGE;

    return await this.spawnAndCollect({
      command,
      args: spawnArgs,
      cwd: os.tmpdir(),
      env: mergedEnv,
      writeStdin,
      timeoutMs,
    });
  }

  private resolveSmokeTestTimeoutMs(): number {
    const raw = this.configService
      .get<string>('AINATIVE_AGENT_CLI_SMOKE_TEST_TIMEOUT_MS', { infer: true })
      ?.trim();
    if (raw) {
      const n = Number.parseInt(raw, 10);
      if (Number.isFinite(n) && n > 0) {
        return Math.min(n, MAX_SMOKE_TIMEOUT_MS);
      }
    }

    return DEFAULT_SMOKE_TIMEOUT_MS;
  }

  private resolveCommand(
    adapter: AgentCliAdapterId,
    runnerConfig: AgentCliRunnerConfigInput,
  ): string {
    const trimmed = runnerConfig.command?.trim();
    if (trimmed) {
      return trimmed;
    }

    return this.resolveDefaultCommand(adapter);
  }

  private resolveDefaultCommand(adapter: AgentCliAdapterId): string {
    const adapterImpl = this.agentCliAdapterRegistry.getById(adapter);
    const envCommand = this.readTrimmedEnv(adapterImpl.runnerCommandEnvKey);
    if (envCommand) {
      return envCommand;
    }

    return adapterImpl.defaultCommand;
  }

  private readTrimmedEnv(key: string): string | undefined {
    return this.configService.get<string>(key, { infer: true })?.trim();
  }

  private resolveRunnerEnv(
    runnerConfig: AgentCliRunnerConfigInput,
  ): Record<string, string> {
    const raw = runnerConfig.env;
    if (!raw || typeof raw !== 'object') {
      return {};
    }

    return Object.entries(raw).reduce<Record<string, string>>(
      (result, [key, value]) => {
        if (typeof value === 'string') {
          result[key] = value;
        }
        return result;
      },
      {},
    );
  }

  /**
   * Aligns with {@link ControlPlaneAgentExecutionService.buildLocalEnvironment}
   * so smoke tests see the same PATH / keys as real control-plane runs.
   */
  private buildLocalEnvironment(
    envOverrides: Record<string, string>,
  ): NodeJS.ProcessEnv {
    const baseEnv = this.pickBaseEnvironment([
      'PATH',
      'HOME',
      'USER',
      'SHELL',
      'TMPDIR',
      'TMP',
      'TEMP',
      'LANG',
      'LC_ALL',
      'TERM',
      'GEMINI_API_KEY',
    ]);

    return {
      ...baseEnv,
      ...envOverrides,
    };
  }

  private pickBaseEnvironment(keys: string[]): NodeJS.ProcessEnv {
    return keys.reduce<NodeJS.ProcessEnv>((result, key) => {
      const value = this.configService.get<string>(key, { infer: true });
      if (value) {
        result[key] = value;
      }
      return result;
    }, {});
  }

  /**
   * Heuristic: some CLIs exit 0 while streaming an error payload (e.g. auth).
   */
  private looksLikeAuthFailure(stdout: string, stderr: string): boolean {
    const combined = `${stdout}\n${stderr}`.toLowerCase();
    const needles = [
      '401',
      '403',
      'unauthorized',
      'invalid api key',
      'incorrect api key',
      'authentication failed',
      'api key invalid',
      'invalid key',
      'access denied',
    ];

    return needles.some((n) => combined.includes(n));
  }

  private async spawnAndCollect(params: {
    command: string;
    args: string[];
    cwd: string;
    env: NodeJS.ProcessEnv;
    writeStdin: string | null;
    timeoutMs: number;
  }): Promise<AgentCliSmokeTestResult> {
    const base: AgentCliSmokeTestResult = {
      ok: false,
      exitCode: null,
      command: params.command,
      args: params.args,
    };

    const child = this.localProcessLauncher.spawn({
      command: params.command,
      args: params.args,
      cwd: params.cwd,
      env: params.env,
    });

    let stdout = '';
    let stderr = '';

    child.stdout?.on('data', (chunk: Buffer | string) => {
      stdout += this.toChunkText(chunk);
      if (stdout.length > STREAM_PREVIEW_MAX_CHARS * 2) {
        stdout = stdout.slice(-STREAM_PREVIEW_MAX_CHARS * 2);
      }
    });

    child.stderr?.on('data', (chunk: Buffer | string) => {
      stderr += this.toChunkText(chunk);
      if (stderr.length > STREAM_PREVIEW_MAX_CHARS * 2) {
        stderr = stderr.slice(-STREAM_PREVIEW_MAX_CHARS * 2);
      }
    });

    if (params.writeStdin) {
      try {
        child.stdin?.write(params.writeStdin);
        child.stdin?.end();
      } catch {
        /* ignore broken pipe */
      }
    }

    return await new Promise<AgentCliSmokeTestResult>((resolve) => {
      let settled = false;
      const timeoutRef = setTimeout(() => {
        if (settled) {
          return;
        }
        settled = true;
        try {
          child.kill('SIGTERM');
        } catch {
          /* ignore */
        }
        setTimeout(() => {
          try {
            child.kill('SIGKILL');
          } catch {
            /* ignore */
          }
        }, 2_000);

        resolve({
          ...base,
          stdoutPreview: this.truncatePreview(stdout),
          stderrPreview: this.truncatePreview(stderr),
          errorCode: 'TIMEOUT',
        });
      }, params.timeoutMs);

      child.on('error', (err: NodeJS.ErrnoException) => {
        if (settled) {
          return;
        }
        settled = true;
        clearTimeout(timeoutRef);

        const code =
          err.code === 'ENOENT' ? 'ENOENT' : ('SPAWN_ERROR' as const);

        resolve({
          ...base,
          stdoutPreview: this.truncatePreview(stdout),
          stderrPreview: this.truncatePreview(
            stderr || err.message || String(err),
          ),
          errorCode: code,
        });
      });

      child.on('close', (code) => {
        if (settled) {
          return;
        }
        settled = true;
        clearTimeout(timeoutRef);

        const exitCode = code === null ? -1 : code;
        let ok = exitCode === 0;
        let errorCode: AgentCliSmokeErrorCode | undefined;

        if (ok && this.looksLikeAuthFailure(stdout, stderr)) {
          ok = false;
          errorCode = 'AUTH_ERROR';
        } else if (!ok) {
          errorCode = 'NON_ZERO';
        }

        resolve({
          ...base,
          ok,
          exitCode,
          stdoutPreview: this.truncatePreview(stdout),
          stderrPreview: this.truncatePreview(stderr),
          ...(errorCode ? { errorCode } : {}),
        });
      });
    });
  }

  private toChunkText(chunk: Buffer | string): string {
    return typeof chunk === 'string' ? chunk : chunk.toString('utf-8');
  }

  private truncatePreview(text: string): string | undefined {
    const trimmed = text.trimEnd();
    if (!trimmed) {
      return undefined;
    }

    if (trimmed.length <= STREAM_PREVIEW_MAX_CHARS) {
      return trimmed;
    }

    return `${trimmed.slice(0, STREAM_PREVIEW_MAX_CHARS)}…`;
  }
}
