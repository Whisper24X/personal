import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import path from 'path';
import { ProjectRepository } from '../projects/infrastructure/persistence/project.repository';
import { ProjectRepositoryWorkspaceService } from '../projects/project-repository-workspace.service';
import { ProjectMemoryInternalDocsService } from './project-memory-internal-docs.service';
import { TaskRepository } from '../tasks/infrastructure/persistence/task.repository';
import { resolveAinativeDataRootDir } from '../utils/workspace-paths';
import { MemoryLlmService } from './memory-llm.service';
import { MemoryMetricsService } from './memory-metrics.service';
import { MemoryIngestRegistry } from './memory-ingest.registry';
import { MemoryInjectRegistry } from './memory-inject.registry';
import { MemoryIngestJobEntity } from './infrastructure/persistence/memory-ingest-job.entity';
import { AgentToolOpenAiCompatibleLlmCredentialsService } from '../agent-execution/agent-tool-openai-compatible-llm-credentials.service';
import {
  applyOpenAiProcessEnvFallback,
  finalizeMemoryLlmModelIfBlank,
  loadMemoryRuntimeConfigFromEnv,
  mergeLlmTripleIfBlankFromPartial,
  type MemoryRuntimeConfigSnapshot,
} from './memory-runtime.config';
import { redactMemoryText } from './memory-redact.util';
import type { HostCapabilities } from './memory.types';
import type { MemoryInjectContext } from './memory.types';

@Injectable()
export class MemoryHostService {
  private readonly logger = new Logger(MemoryHostService.name);

  constructor(
    private readonly internalDocs: ProjectMemoryInternalDocsService,
    private readonly taskRepository: TaskRepository,
    private readonly projectRepository: ProjectRepository,
    private readonly projectRepositoryWorkspace: ProjectRepositoryWorkspaceService,
    private readonly llm: MemoryLlmService,
    private readonly metrics: MemoryMetricsService,
    private readonly ingestRegistry: MemoryIngestRegistry,
    private readonly injectRegistry: MemoryInjectRegistry,
    private readonly agentToolOpenAiLlmCredentials: AgentToolOpenAiCompatibleLlmCredentialsService,
  ) {}

  async runIngestJobRow(row: MemoryIngestJobEntity): Promise<void> {
    const snap = loadMemoryRuntimeConfigFromEnv();
    if (!snap.extractionEnabled) {
      return;
    }
    const plugin = this.ingestRegistry.get(snap.ingestPluginId);
    if (!plugin) {
      this.logger.warn(`no ingest plugin ${snap.ingestPluginId}`);
      return;
    }
    const job = (
      row.payload as {
        job?: {
          kind: 'task_done';
          projectId: string;
          taskId: string;
          idempotencyKey: string;
        };
      }
    )?.job;
    if (!job || job.kind !== 'task_done') {
      return;
    }
    const caps = await this.createIngestHostCapabilities({
      projectId: job.projectId,
      idempotencyKey: job.idempotencyKey,
    });
    await plugin.onTaskDone(
      {
        kind: 'task_done',
        projectId: job.projectId,
        taskId: job.taskId,
        idempotencyKey: job.idempotencyKey,
      },
      caps,
    );
  }

  async mergeRuntimeConfigForProject(
    projectId: string,
  ): Promise<MemoryRuntimeConfigSnapshot> {
    let snap = loadMemoryRuntimeConfigFromEnv();
    const project = await this.projectRepository.findById(projectId);
    if (project) {
      const fromDb =
        await this.agentToolOpenAiLlmCredentials.resolvePartialOpenAiCompatibleLlmFromPersistedDefaults(
          project,
        );
      snap = mergeLlmTripleIfBlankFromPartial(snap, fromDb);
    }
    snap = applyOpenAiProcessEnvFallback(snap);
    return finalizeMemoryLlmModelIfBlank(snap);
  }

  private async createIngestHostCapabilities(args: {
    projectId: string;
    idempotencyKey: string;
  }): Promise<HostCapabilities> {
    const snap = await this.mergeRuntimeConfigForProject(args.projectId);
    const { idempotencyKey } = args;
    return {
      logger: this.createLogger('ingest', { idempotencyKey }),
      metrics: { increment: (n, t) => this.metrics.increment(n, t) },
      writeDoc: async (wArgs) => {
        const r = redactMemoryText(wArgs.content);
        return this.internalDocs.writeDoc({ ...wArgs, content: r });
      },
      readDoc: (rArgs) =>
        this.internalDocs.readDoc(rArgs.projectId, rArgs.relativePath),
      completeJson: async (a) => {
        const data = await this.llm.completeJson<unknown>({
          config: snap,
          system: a.system,
          user: a.user,
          maxOutputTokens: a.maxOutputTokens,
        });
        return {
          raw: JSON.stringify(data),
          parse: <T>() => data as T,
        };
      },
      getTaskWorkspaceMeta: (taskId) => this.getTaskWorkspaceMetaImpl(taskId),
      redact: redactMemoryText,
      config: snap,
      idempotentDone: () => Promise.resolve(false),
      markIngestDone: () => Promise.resolve(),
    };
  }

  private createInjectHostCapabilitiesForSnapshot(
    snap: MemoryRuntimeConfigSnapshot,
  ): HostCapabilities {
    return {
      logger: this.createLogger('inject', {}),
      metrics: { increment: (n, t) => this.metrics.increment(n, t) },
      writeDoc: () =>
        Promise.reject(new Error('memory inject plugin must not write docs')),
      readDoc: (args) =>
        this.internalDocs.readDoc(args.projectId, args.relativePath),
      completeJson: () =>
        Promise.reject(new Error('inject: completeJson not used')),
      getTaskWorkspaceMeta: (taskId) => this.getTaskWorkspaceMetaImpl(taskId),
      redact: redactMemoryText,
      config: snap,
      idempotentDone: () => Promise.resolve(false),
      markIngestDone: () => Promise.resolve(),
    };
  }

  private createLogger(
    kind: 'ingest' | 'inject',
    meta: Record<string, unknown>,
  ): HostCapabilities['logger'] {
    const base = this.logger;
    const scope = () => JSON.stringify({ kind, ...meta });
    return {
      debug: (m, ...a) => base.debug(`${m} ${scope()} ${String(a)}`),
      info: (m, ...a) => base.log(`${m} ${scope()} ${String(a)}`),
      warn: (m, ...a) => base.warn(`${m} ${scope()} ${String(a)}`),
      error: (m, ...a) => base.error(`${m} ${scope()} ${String(a)}`),
      child: (m) => this.createLogger(kind, { ...meta, ...m }),
    } as HostCapabilities['logger'];
  }

  private async getTaskWorkspaceMetaImpl(taskId: string): Promise<{
    businessLineId: string;
    projectId: string;
    dataRootResolved: string;
    repositoryRoot: string | null;
  }> {
    const task = await this.taskRepository.findById(taskId);
    if (!task) {
      throw new NotFoundException('task not found');
    }
    const dataRoot = resolveAinativeDataRootDir();
    const dataRootResolved = path.join(
      dataRoot,
      task.businessLineId,
      'projects',
      task.projectId,
    );
    const project = await this.projectRepository.findById(task.projectId);
    const repositoryRoot = project
      ? await this.projectRepositoryWorkspace.ensureProjectRepository(project, {
          syncRemote: false,
        })
      : null;
    return {
      businessLineId: task.businessLineId,
      projectId: task.projectId,
      dataRootResolved,
      repositoryRoot,
    };
  }

  async buildInjectBlock(ctx: MemoryInjectContext): Promise<string> {
    const snap = await this.mergeRuntimeConfigForProject(ctx.projectId);
    if (!snap.injectionEnabled) {
      return '';
    }
    const plugin = this.injectRegistry.get(snap.injectPluginId);
    if (!plugin) {
      return '';
    }
    const caps = this.createInjectHostCapabilitiesForSnapshot(snap);
    const { text } = await plugin.build(ctx, caps);
    return redactMemoryText(text);
  }
}
