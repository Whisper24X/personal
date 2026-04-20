import { Injectable, Logger, Optional } from '@nestjs/common';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { ContainerExecutionConfigService } from '../containers/container-execution-config.service';
import type { Project } from '../projects/domain/project';
import type { Task } from '../tasks/domain/task';
import type { TaskNode } from '../tasks/domain/task-node';
import type { EphemeralMcpTemplate } from './ephemeral-mcp.types';
import { parseEphemeralMcpConfig } from './parse-ephemeral-mcp-config';

const execFileAsync = promisify(execFile);

function shellQuote(arg: string): string {
  if (arg.length === 0) {
    return `''`;
  }
  if (!/[^a-zA-Z0-9@%_+=:,./-]/.test(arg)) {
    return arg;
  }

  return `'${arg.replace(/'/g, `'\\''`)}'`;
}

function buildSpawnInnerCommand(template: EphemeralMcpTemplate): string {
  const parts = [
    shellQuote(template.command),
    ...(template.args ?? []).map((a) => shellQuote(a)),
  ].join(' ');
  return parts;
}

@Injectable()
export class RunnerEphemeralMcpService {
  private readonly logger = new Logger(RunnerEphemeralMcpService.name);
  private readonly defaultMaxTemplates = 8;
  private readonly healthPollMs = 500;

  constructor(
    @Optional()
    private readonly containerExecutionConfig?: ContainerExecutionConfigService,
  ) {}

  /**
   * Starts enabled HTTP MCP templates inside the runner container and returns env entries + teardown.
   */
  async startSessions(input: {
    project: Project;
    task: Task;
    node: TaskNode;
    containerExecRef: string;
  }): Promise<{
    mergedEnv: Record<string, string>;
    teardown: () => Promise<void>;
  }> {
    const configJson =
      input.project.configJson && typeof input.project.configJson === 'object'
        ? (input.project.configJson as Record<string, unknown>)
        : {};
    const parsed = parseEphemeralMcpConfig(configJson);
    if (!parsed?.templates?.length) {
      return {
        mergedEnv: {},
        teardown: async () => {},
      };
    }

    const workspace =
      this.containerExecutionConfig?.getRunnerWorkspace() ?? '/workspace';

    const enabledTemplates = parsed.templates.filter(
      (t) => t.enabled !== false,
    );
    const max = parsed.maxConcurrentPerRunner ?? this.defaultMaxTemplates;
    const slice = enabledTemplates.slice(0, max);
    if (enabledTemplates.length > max) {
      this.logger.warn(
        `mcp_ephemeral_skip_over_limit ${JSON.stringify({
          taskId: input.task.id,
          nodeId: input.node.id,
          total: enabledTemplates.length,
          maxConcurrentPerRunner: max,
        })}`,
      );
    }

    const auditEnv = this.buildAuditEnv(input, parsed.injectAuditEnv !== false);
    const teardowns: Array<() => Promise<void>> = [];
    const mergedEnv: Record<string, string> = {};

    for (const template of slice) {
      const pidTag = this.pidTag(input.task.id, template.id);
      try {
        await this.spawnOneHttpMcp({
          containerRef: input.containerExecRef,
          template,
          pidTag,
          workspace,
          auditEnv,
          taskId: input.task.id,
          nodeId: input.node.id,
        });

        const healthPath = template.healthPath ?? '/';
        const urlPath = template.urlPath ?? '/sse';
        const spawnTimeoutMs = template.spawnTimeoutMs ?? 120_000;
        await this.waitHealthy({
          containerRef: input.containerExecRef,
          port: template.listenPort,
          healthPath,
          spawnTimeoutMs,
          templateId: template.id,
          taskId: input.task.id,
        });

        const baseUrl = `http://127.0.0.1:${template.listenPort}${urlPath}`;
        const envVar =
          template.envVarName?.trim() ||
          `AINATIVE_EPHEMERAL_MCP_${this.normalizeEnvKey(template.id)}_URL`;
        mergedEnv[envVar] = baseUrl;

        this.logger.log(
          `mcp_ephemeral_spawn ${JSON.stringify({
            event: 'ok',
            taskId: input.task.id,
            nodeId: input.node.id,
            templateId: template.id,
            listenPort: template.listenPort,
            envVar,
            baseUrl,
          })}`,
        );

        teardowns.push(() =>
          this.teardownOne({
            containerRef: input.containerExecRef,
            template,
            pidTag,
            taskId: input.task.id,
          }),
        );
      } catch (error) {
        this.logger.error(
          `mcp_ephemeral_spawn ${JSON.stringify({
            event: 'failed',
            taskId: input.task.id,
            nodeId: input.node.id,
            templateId: template.id,
            message: error instanceof Error ? error.message : String(error),
          })}`,
        );
        for (const fn of teardowns.reverse()) {
          await fn();
        }
        throw error;
      }
    }

    return {
      mergedEnv,
      teardown: async () => {
        for (const fn of teardowns.reverse()) {
          await fn();
        }
      },
    };
  }

  private buildAuditEnv(
    input: { task: Task; node: TaskNode; project: Project },
    enabled: boolean,
  ): Record<string, string> {
    if (!enabled) {
      return {};
    }
    const base: Record<string, string> = {
      AINATIVE_TASK_ID: input.task.id,
      AINATIVE_NODE_ID: input.node.id,
      AINATIVE_PROJECT_ID: input.project.id,
      AINATIVE_BUSINESS_LINE_ID: input.project.businessLineId,
      AINATIVE_EPHEMERAL_MCP_CONTEXT: JSON.stringify({
        taskId: input.task.id,
        nodeId: input.node.id,
        projectId: input.project.id,
        businessLineId: input.project.businessLineId,
      }),
    };
    return base;
  }

  private normalizeEnvKey(id: string): string {
    return id.replace(/[^a-zA-Z0-9]+/g, '_').replace(/^_|_$/g, '') || 'MCP';
  }

  private pidTag(taskId: string, templateId: string): string {
    const safeTask = taskId.replace(/[^a-zA-Z0-9_-]+/g, '_').slice(0, 48);
    const safeTpl = templateId.replace(/[^a-zA-Z0-9_-]+/g, '_').slice(0, 48);
    return `${safeTask}__${safeTpl}`;
  }

  private async spawnOneHttpMcp(params: {
    containerRef: string;
    template: EphemeralMcpTemplate;
    pidTag: string;
    workspace: string;
    auditEnv: Record<string, string>;
    taskId: string;
    nodeId: string;
  }): Promise<void> {
    const {
      containerRef,
      template,
      pidTag,
      workspace,
      auditEnv,
      taskId,
      nodeId,
    } = params;
    const cwdInContainer = template.cwdInContainer ?? workspace;
    const inner = buildSpawnInnerCommand(template);
    const pidFile = `/tmp/ainative-ephemeral-mcp-${pidTag}.pid`;
    const logFile = `/tmp/ainative-ephemeral-mcp-${pidTag}.log`;
    const shellScript = `cd ${shellQuote(cwdInContainer)} && nohup ${inner} </dev/null >>${shellQuote(logFile)} 2>&1 & echo $! > ${shellQuote(pidFile)}`;

    const envArgs: string[] = [];
    for (const [k, v] of Object.entries({
      ...auditEnv,
      ...(template.env ?? {}),
    })) {
      envArgs.push('-e', `${k}=${v}`);
    }

    const args = [
      'exec',
      '-d',
      ...envArgs,
      '-w',
      cwdInContainer,
      containerRef,
      'bash',
      '-lc',
      shellScript,
    ];

    const startedAt = Date.now();
    await execFileAsync('docker', args, { timeout: 30_000 });
    this.logger.log(
      `mcp_ephemeral_spawn ${JSON.stringify({
        event: 'exec_submitted',
        taskId,
        nodeId,
        templateId: template.id,
        durationMs: Date.now() - startedAt,
      })}`,
    );
  }

  private async waitHealthy(params: {
    containerRef: string;
    port: number;
    healthPath: string;
    spawnTimeoutMs: number;
    templateId: string;
    taskId: string;
  }): Promise<void> {
    const deadline = Date.now() + params.spawnTimeoutMs;

    while (Date.now() < deadline) {
      const ok = await this.probeHttpOnce(params);
      if (ok) {
        return;
      }
      await this.delay(this.healthPollMs);
    }

    throw new Error(
      `Ephemeral MCP "${params.templateId}" did not become ready within ${params.spawnTimeoutMs}ms (taskId=${params.taskId})`,
    );
  }

  private async probeHttpOnce(params: {
    containerRef: string;
    port: number;
    healthPath: string;
  }): Promise<boolean> {
    const url = `http://127.0.0.1:${params.port}${params.healthPath}`;
    const curlProbe = `curl -fsS -o /dev/null -w "%{http_code}" ${shellQuote(url)} 2>/dev/null || true`;

    try {
      const r = await execFileAsync(
        'docker',
        ['exec', params.containerRef, 'bash', '-lc', curlProbe],
        { timeout: 10_000 },
      );
      const code = parseInt(String(r.stdout).trim(), 10);
      if (!Number.isNaN(code) && code >= 200 && code < 500) {
        return true;
      }
    } catch {
      return false;
    }
    return false;
  }

  private async teardownOne(input: {
    containerRef: string;
    template: EphemeralMcpTemplate;
    pidTag: string;
    taskId: string;
  }): Promise<void> {
    const pidFile = `/tmp/ainative-ephemeral-mcp-${input.pidTag}.pid`;
    const port = input.template.listenPort;
    const script = `set +e; if [ -f '${pidFile}' ]; then kill "$(cat '${pidFile}' 2>/dev/null)" 2>/dev/null; fi; command -v fuser >/dev/null 2>&1 && fuser -k ${port}/tcp 2>/dev/null; true`;
    const startedAt = Date.now();
    try {
      await execFileAsync('docker', [
        'exec',
        input.containerRef,
        'bash',
        '-lc',
        script,
      ]);
    } catch (error) {
      this.logger.warn(
        `mcp_ephemeral_stop ${JSON.stringify({
          event: 'teardown_error',
          taskId: input.taskId,
          templateId: input.template.id,
          message: error instanceof Error ? error.message : String(error),
        })}`,
      );
    } finally {
      this.logger.log(
        `mcp_ephemeral_stop ${JSON.stringify({
          event: 'done',
          taskId: input.taskId,
          templateId: input.template.id,
          durationMs: Date.now() - startedAt,
        })}`,
      );
    }
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
