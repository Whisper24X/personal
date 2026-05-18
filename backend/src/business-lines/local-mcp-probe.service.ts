import { BadRequestException, Injectable } from '@nestjs/common';
import path from 'path';
import { Client } from '@modelcontextprotocol/sdk/client';
import { SSEClientTransport } from '@modelcontextprotocol/sdk/client/sse.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { AgentCliSmokeTestService } from '../agent-execution/agent-cli-smoke-test.service';
import { AgentCliAdapterRegistry } from '../agent-execution/agent-cli/agent-cli-adapter.registry';
import type { AgentCliAdapterId } from '../agent-execution/agent-cli/agent-cli-adapter.interface';
import { sanitizeAgentToolConfigJson } from '../agent-execution/agent-cli-sanitize-config';
import { LocalMcpProbeResultDto } from './dto/local-mcp-probe-result.dto';
import type { AgentToolConfig } from './domain/agent-tool-config';

const STDERR_PREVIEW_MAX_CHARS = 800;

type ClassifiedMcp =
  | {
      transport: 'stdio';
      command: string;
      args: string[];
      env: Record<string, string>;
    }
  | {
      transport: 'sse';
      url: string;
      headers: Record<string, string>;
    }
  | {
      transport: 'http';
      url: string;
      headers: Record<string, string>;
    };

export type RunnerMcpProbeContext = {
  containerRef: string;
  cwdInContainer: string;
};

@Injectable()
export class LocalMcpProbeService {
  constructor(
    private readonly agentCliSmokeTestService: AgentCliSmokeTestService,
    private readonly agentCliAdapterRegistry: AgentCliAdapterRegistry,
  ) {}

  async probeWithResolvedLocal(params: {
    agentToolConfig: Pick<AgentToolConfig, 'toolId' | 'configJson'>;
    local: {
      name: string;
      sourcePath: string;
      config: Record<string, unknown>;
    };
    runner?: RunnerMcpProbeContext;
  }): Promise<LocalMcpProbeResultDto> {
    const agentConfig = params.agentToolConfig;
    const local = params.local;

    const configJson = this.parseConfigJson(agentConfig.configJson);
    const agentEnv =
      this.agentCliSmokeTestService.buildProbeEnvironmentForAgentToolConfig({
        toolId: agentConfig.toolId,
        configJson,
      });

    const adapter = this.agentCliAdapterRegistry.resolve(agentConfig.toolId);
    if (!adapter) {
      throw new BadRequestException('Unsupported agent CLI tool id');
    }

    const sanitized = sanitizeAgentToolConfigJson(
      this.agentCliAdapterRegistry,
      adapter,
      configJson,
    );

    const warnings = this.collectAgentMcpWarnings({
      adapter,
      sanitized,
      serverName: local.name,
      resolvedMcpJsonPath: path.resolve(local.sourcePath.trim()),
    });

    const classified = this.classifyMcpServerConfig(local.config, local.name);
    const runnerStdioProbe =
      params.runner && classified.transport === 'stdio'
        ? params.runner
        : undefined;
    const timeoutMs =
      this.agentCliSmokeTestService.resolveLocalMcpProbeTimeoutMs();

    try {
      const toolsCount = await this.runMcpClientProbe({
        classified,
        agentEnv,
        timeoutMs,
        runner: runnerStdioProbe,
      });

      return {
        ok: true,
        transport: classified.transport,
        toolsCount,
        ...(runnerStdioProbe
          ? {
              executionPlane: 'runner' as const,
              containerId: runnerStdioProbe.containerRef,
              cwd: runnerStdioProbe.cwdInContainer,
            }
          : { executionPlane: 'backend' as const }),
        warnings: warnings.length > 0 ? warnings : undefined,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const code =
        error instanceof Error && error.name === 'McpProbeTimeoutError'
          ? 'TIMEOUT'
          : 'PROBE_FAILED';

      return {
        ok: false,
        transport: classified.transport,
        errorCode: code,
        message,
        stderrPreview: this.extractStderrPreview(error),
        ...(runnerStdioProbe
          ? {
              executionPlane: 'runner' as const,
              containerId: runnerStdioProbe.containerRef,
              cwd: runnerStdioProbe.cwdInContainer,
            }
          : { executionPlane: 'backend' as const }),
        warnings: warnings.length > 0 ? warnings : undefined,
      };
    }
  }

  private parseConfigJson(configJson: string): Record<string, unknown> {
    if (!configJson.trim()) {
      return {};
    }

    try {
      const parsed = JSON.parse(configJson);
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        return parsed as Record<string, unknown>;
      }
    } catch {
      return {};
    }

    return {};
  }

  private collectAgentMcpWarnings(params: {
    adapter: AgentCliAdapterId;
    sanitized: Record<string, unknown>;
    serverName: string;
    resolvedMcpJsonPath: string;
  }): string[] {
    const warnings: string[] = [];
    const norm = path.normalize(path.resolve(params.resolvedMcpJsonPath));

    if (params.adapter === 'claude') {
      const mcpConfig = this.resolveStringArray(params.sanitized.mcp_config);
      let pathHit = false;
      for (const item of mcpConfig) {
        const t = item.trim();
        if (t.startsWith('{')) {
          continue;
        }
        try {
          if (path.normalize(path.resolve(t)) === norm) {
            pathHit = true;
            break;
          }
        } catch {
          /* ignore */
        }
      }
      if (!pathHit) {
        warnings.push('AGENT_MCP_CONFIG_MAY_NOT_REFERENCE_BUSINESS_LINE_FILE');
      }
    }

    if (params.adapter === 'gemini') {
      const extensions = this.resolveStringArray(params.sanitized.extensions);
      const allowed = this.resolveStringArray(
        params.sanitized.allowed_mcp_server_names,
      );

      const extHit = extensions.some((e) => {
        try {
          return path.normalize(path.resolve(e.trim())) === norm;
        } catch {
          return false;
        }
      });
      const nameHit = allowed.some(
        (n) => n.trim() === params.serverName.trim(),
      );

      if (!extHit && !nameHit) {
        warnings.push(
          'AGENT_GEMINI_MCP_MAY_NOT_REFERENCE_BUSINESS_LINE_FILE_OR_NAME',
        );
      }
    }

    return warnings;
  }

  private resolveStringArray(value: unknown): string[] {
    if (!Array.isArray(value)) {
      return [];
    }

    return value
      .map((item) => (typeof item === 'string' ? item.trim() : ''))
      .filter(Boolean);
  }

  private classifyMcpServerConfig(
    config: Record<string, unknown>,
    serverName: string,
  ): ClassifiedMcp {
    const url =
      typeof config.url === 'string' && config.url.trim()
        ? config.url.trim()
        : '';

    if (url) {
      const typeRaw =
        typeof config.type === 'string' ? config.type.trim().toLowerCase() : '';
      const headers = this.normalizeStringMap(config.headers);

      if (typeRaw === 'sse') {
        return { transport: 'sse', url, headers };
      }

      return { transport: 'http', url, headers };
    }

    const command =
      typeof config.command === 'string' && config.command.trim()
        ? config.command.trim()
        : '';

    if (!command) {
      throw new BadRequestException(
        `MCP server "${serverName}" must include command or url (JSON/TOML 占位条目不支持探测)`,
      );
    }

    const args = this.normalizeStringArray(config.args, serverName);
    const env = this.normalizeStringMap(config.env);

    return {
      transport: 'stdio',
      command,
      args,
      env,
    };
  }

  private normalizeStringArray(value: unknown, serverName: string): string[] {
    if (value === undefined || value === null) {
      return [];
    }

    if (!Array.isArray(value)) {
      throw new BadRequestException(
        `Invalid MCP args for server "${serverName}"`,
      );
    }

    return value
      .map((item) => {
        if (typeof item !== 'string') {
          throw new BadRequestException(
            `Invalid MCP args for server "${serverName}"`,
          );
        }
        return item.trim();
      })
      .filter(Boolean);
  }

  private normalizeStringMap(value: unknown): Record<string, string> {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      return {};
    }

    const result: Record<string, string> = {};
    for (const [key, entry] of Object.entries(value)) {
      const normalizedKey = key.trim();
      if (!normalizedKey || typeof entry !== 'string') {
        continue;
      }

      result[normalizedKey] = entry;
    }

    return result;
  }

  private toStringRecord(env: NodeJS.ProcessEnv): Record<string, string> {
    const o: Record<string, string> = {};
    for (const [k, v] of Object.entries(env)) {
      if (typeof v === 'string') {
        o[k] = v;
      }
    }
    return o;
  }

  private async runMcpClientProbe(params: {
    classified: ClassifiedMcp;
    agentEnv: NodeJS.ProcessEnv;
    timeoutMs: number;
    runner?: RunnerMcpProbeContext;
  }): Promise<number> {
    const client = new Client(
      { name: 'ainative-local-mcp-probe', version: '1.0.0' },
      {},
    );

    let transport:
      | StdioClientTransport
      | SSEClientTransport
      | StreamableHTTPClientTransport
      | undefined;
    let stderrText = '';

    try {
      if (params.classified.transport === 'stdio') {
        const mergedEnv = {
          ...this.toStringRecord(params.agentEnv),
          ...params.classified.env,
        };
        const stdioCommand = params.runner
          ? this.buildRunnerDockerExecCommand({
              classified: params.classified,
              env: mergedEnv,
              runner: params.runner,
            })
          : {
              command: params.classified.command,
              args: params.classified.args,
              env: mergedEnv,
            };

        transport = new StdioClientTransport({
          command: stdioCommand.command,
          args: stdioCommand.args,
          env: stdioCommand.env,
          stderr: 'pipe',
        });

        const probeStderr = transport.stderr;
        if (probeStderr) {
          probeStderr.on('data', (chunk: Buffer | string) => {
            stderrText +=
              typeof chunk === 'string' ? chunk : chunk.toString('utf8');
            if (stderrText.length > STDERR_PREVIEW_MAX_CHARS * 2) {
              stderrText = stderrText.slice(-STDERR_PREVIEW_MAX_CHARS * 2);
            }
          });
        }
      } else if (params.classified.transport === 'sse') {
        transport = new SSEClientTransport(new URL(params.classified.url), {
          requestInit: {
            headers: this.headersToRecord(params.classified.headers),
          },
        });
      } else {
        transport = new StreamableHTTPClientTransport(
          new URL(params.classified.url),
          {
            requestInit: {
              headers: this.headersToRecord(params.classified.headers),
            },
          },
        );
      }

      const run = async (): Promise<number> => {
        await client.connect(transport!);
        const listed = await client.listTools();
        return listed.tools?.length ?? 0;
      };

      return await this.withTimeout(run(), params.timeoutMs, async () => {
        await client.close().catch(() => undefined);
        await transport?.close().catch(() => undefined);
      });
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      if (stderrText.trim()) {
        Object.assign(err, {
          stderrPreview: this.truncatePreview(stderrText),
        });
      }
      throw err;
    } finally {
      await client.close().catch(() => undefined);
      await transport?.close().catch(() => undefined);
    }
  }

  private buildRunnerDockerExecCommand(params: {
    classified: Extract<ClassifiedMcp, { transport: 'stdio' }>;
    env: Record<string, string>;
    runner: RunnerMcpProbeContext;
  }): {
    command: string;
    args: string[];
    env: Record<string, string>;
  } {
    const execEnv = this.toStringRecord(process.env);
    const envArgs: string[] = ['-e', 'HOME=/root'];
    for (const [key, value] of Object.entries(params.env)) {
      if (!key || value === undefined || value === null) {
        continue;
      }
      if (key === 'PATH' || key === 'PWD' || key === 'OLDPWD') {
        continue;
      }
      envArgs.push('-e', `${key}=${value}`);
    }

    return {
      command: 'docker',
      args: [
        'exec',
        '-i',
        '-w',
        params.runner.cwdInContainer,
        ...envArgs,
        params.runner.containerRef,
        params.classified.command,
        ...params.classified.args,
      ],
      env: execEnv,
    };
  }

  private headersToRecord(
    headers: Record<string, string>,
  ): Record<string, string> {
    return { ...headers };
  }

  private async withTimeout<T>(
    promise: Promise<T>,
    ms: number,
    onTimeout: () => Promise<void>,
  ): Promise<T> {
    let timeoutRef: NodeJS.Timeout | undefined;
    try {
      return await Promise.race([
        promise,
        new Promise<T>((_, reject) => {
          timeoutRef = setTimeout(() => {
            const err = new Error(`MCP probe timed out after ${ms}ms`);
            err.name = 'McpProbeTimeoutError';
            void onTimeout().finally(() => {
              reject(err);
            });
          }, ms);
          timeoutRef.unref?.();
        }),
      ]);
    } finally {
      if (timeoutRef) {
        clearTimeout(timeoutRef);
      }
    }
  }

  private truncatePreview(text: string): string {
    const t = text.trim();
    if (t.length <= STDERR_PREVIEW_MAX_CHARS) {
      return t;
    }
    return `${t.slice(0, STDERR_PREVIEW_MAX_CHARS)}…`;
  }

  private extractStderrPreview(error: unknown): string | undefined {
    if (
      error &&
      typeof error === 'object' &&
      'stderrPreview' in error &&
      typeof (error as { stderrPreview?: unknown }).stderrPreview === 'string'
    ) {
      return (error as { stderrPreview: string }).stderrPreview;
    }
    return undefined;
  }
}
