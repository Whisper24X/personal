import { ConflictException, Injectable } from '@nestjs/common';
import { TaskNode } from '../domain/task-node';
import {
  TaskConfig,
  TaskLoopConfig,
  TaskNodeConfig,
  TaskNodeInput,
  TaskNodeRuntime,
} from '../types/task-config.type';

@Injectable()
export class TaskConfigResolverService {
  mergeTaskConfig(
    currentConfig: Record<string, unknown> | null | undefined,
    incomingConfig: Record<string, unknown> | null | undefined,
  ): TaskConfig | null {
    const merged = {
      ...this.toObjectRecord(currentConfig),
      ...this.toObjectRecord(incomingConfig),
    } as TaskConfig;

    const workflowTemplateId = this.normalizeOptionalString(
      typeof merged.workflowTemplateId === 'string'
        ? merged.workflowTemplateId
        : null,
    );
    const agentCliId = this.normalizeOptionalString(
      typeof merged.agentCliId === 'string'
        ? merged.agentCliId
        : typeof merged.cliToolId === 'string'
          ? merged.cliToolId
          : null,
    );
    const agentCliConfigId = this.normalizeOptionalString(
      typeof merged.agentCliConfigId === 'string'
        ? merged.agentCliConfigId
        : typeof merged.agentToolConfigId === 'string'
          ? merged.agentToolConfigId
          : null,
    );
    const loopEnabled = this.normalizeBoolean(
      typeof merged.loopEnabled === 'boolean' ? merged.loopEnabled : null,
    );
    const maxLoops = this.normalizeMaxLoops(merged.maxLoops, false);

    if (workflowTemplateId) {
      merged.workflowTemplateId = workflowTemplateId;
    } else {
      delete merged.workflowTemplateId;
    }

    if (agentCliId) {
      merged.agentCliId = agentCliId;
    } else {
      delete merged.agentCliId;
    }

    if (agentCliConfigId) {
      merged.agentCliConfigId = agentCliConfigId;
    } else {
      delete merged.agentCliConfigId;
    }

    if (loopEnabled !== null) {
      merged.loopEnabled = loopEnabled;
    } else {
      delete merged.loopEnabled;
    }

    if (maxLoops !== null) {
      merged.maxLoops = maxLoops;
    } else {
      delete merged.maxLoops;
    }

    delete merged.cliToolId;
    delete merged.agentToolConfigId;

    return Object.keys(merged).length ? merged : null;
  }

  readTaskWorkflowTemplateId(
    configJson: Record<string, unknown> | null | undefined,
  ): string | null {
    const config = this.toObjectRecord(configJson);

    return this.normalizeOptionalString(
      typeof config.workflowTemplateId === 'string'
        ? config.workflowTemplateId
        : null,
    );
  }

  readNodeExecutionConfig(
    configJson: Record<string, unknown> | null | undefined,
  ): {
    agentCliId: string | null;
    agentCliConfigId: string | null;
  } {
    const config = this.toObjectRecord(configJson);
    const agentCliId = this.normalizeOptionalString(
      typeof config.agentCliId === 'string'
        ? config.agentCliId
        : typeof config.cliToolId === 'string'
          ? config.cliToolId
          : null,
    );
    const agentCliConfigId = this.normalizeOptionalString(
      typeof config.agentCliConfigId === 'string'
        ? config.agentCliConfigId
        : typeof config.agentToolConfigId === 'string'
          ? config.agentToolConfigId
          : null,
    );

    return {
      agentCliId,
      agentCliConfigId,
    };
  }

  resolveRequiredNodeExecutionConfig(
    configJson: Record<string, unknown> | null | undefined,
    fallback?: {
      agentCliId: string | null;
      agentCliConfigId: string | null;
    } | null,
  ): {
    agentCliId: string;
    agentCliConfigId: string;
  } {
    const config = this.readNodeExecutionConfig(configJson);
    const agentCliId = config.agentCliId ?? fallback?.agentCliId ?? null;
    const agentCliConfigId =
      config.agentCliConfigId ?? fallback?.agentCliConfigId ?? null;

    if (!agentCliId) {
      throw new ConflictException(
        'Task config must include agentCliId for executable task nodes',
      );
    }

    if (!agentCliConfigId) {
      throw new ConflictException(
        'Task config must include agentCliConfigId for executable task nodes',
      );
    }

    return {
      agentCliId,
      agentCliConfigId,
    };
  }

  resolveNodeLoopJson(
    input: Record<string, unknown> | null | undefined,
    taskConfig?: Record<string, unknown> | null,
    currentLoopJson?: Record<string, unknown> | null,
  ): TaskLoopConfig {
    const source = this.toObjectRecord(input);
    const config = this.toObjectRecord(taskConfig);
    const current = this.readNodeLoopConfig(currentLoopJson);
    const maxLoops =
      this.normalizeMaxLoops(source.maxLoops, false) ??
      this.normalizeMaxLoops(config.maxLoops, false) ??
      current.maxLoops;
    const explicitEnabled =
      this.normalizeBoolean(
        typeof source.loopEnabled === 'boolean' ? source.loopEnabled : null,
      ) ??
      this.normalizeBoolean(
        typeof config.loopEnabled === 'boolean' ? config.loopEnabled : null,
      );
    const enabled = explicitEnabled ?? maxLoops > 1;

    return {
      enabled,
      loopCount: current.loopCount,
      maxLoops,
    };
  }

  readNodeLoopConfig(
    loopJson: Record<string, unknown> | null | undefined,
  ): TaskLoopConfig {
    const source = this.toObjectRecord(loopJson);
    const maxLoops = this.normalizeMaxLoops(source.maxLoops) ?? 1;
    const loopCount = Math.max(
      this.normalizeNonNegativeInteger(source.loopCount) ?? 0,
      0,
    );
    const enabled =
      this.normalizeBoolean(
        typeof source.enabled === 'boolean' ? source.enabled : null,
      ) ?? maxLoops > 1;

    return {
      enabled,
      loopCount,
      maxLoops,
    };
  }

  buildTaskNodeInput({
    taskPrompt,
    nodeInput,
    source,
  }: {
    taskPrompt?: string | null;
    nodeInput?: string | null;
    source?: Record<string, unknown> | null;
  }): TaskNodeInput {
    const normalized = {
      ...this.toObjectRecord(source),
      taskInput: this.normalizeOptionalString(taskPrompt),
      nodeInput: this.normalizeOptionalString(nodeInput),
    } as TaskNodeInput;

    delete normalized.prompt;
    delete normalized.instructions;
    delete normalized.loopEnabled;
    delete normalized.maxLoops;
    delete normalized.agentCliId;
    delete normalized.agentCliConfigId;
    delete normalized.cliToolId;
    delete normalized.agentToolConfigId;

    return normalized;
  }

  withTaskInput(
    currentInput: Record<string, unknown> | null | undefined,
    taskPrompt?: string | null,
  ): TaskNodeInput {
    const source = this.toObjectRecord(currentInput);
    const nodeInput = this.normalizeOptionalString(
      typeof source.nodeInput === 'string'
        ? source.nodeInput
        : typeof source.prompt === 'string'
          ? source.prompt
          : typeof source.instructions === 'string'
            ? source.instructions
            : null,
    );

    return this.buildTaskNodeInput({
      source,
      taskPrompt,
      nodeInput,
    });
  }

  readTemplateNodeInput(
    input: Record<string, unknown> | null | undefined,
  ): string | null {
    const source = this.toObjectRecord(input);

    return this.normalizeOptionalString(
      typeof source.nodeInput === 'string'
        ? source.nodeInput
        : typeof source.prompt === 'string'
          ? source.prompt
          : typeof source.instructions === 'string'
            ? source.instructions
            : null,
    );
  }

  buildPendingReplyRuntimeJson(message: string): TaskNodeRuntime {
    return {
      pendingUserMessage: message,
    };
  }

  readNodeRequiresApproval(node: TaskNode): boolean {
    const config = this.toObjectRecord(node.configJson);
    const input = this.toObjectRecord(node.input);

    return (
      this.normalizeBooleanLike(config.requiresApproval) ??
      this.normalizeBooleanLike(input.requiresApproval) ??
      false
    );
  }

  buildTaskNodeConfig(templateNode: {
    requiresApproval?: boolean;
  }): TaskNodeConfig | null {
    const requiresApproval = templateNode.requiresApproval === true;

    if (!requiresApproval) {
      return null;
    }

    return { requiresApproval };
  }

  readNodeRuntime(node: TaskNode): TaskNodeRuntime | null {
    const runtime = this.toObjectRecord(node.runtimeJson);

    return Object.keys(runtime).length ? (runtime as TaskNodeRuntime) : null;
  }

  readRuntimeWorkerId(node: TaskNode): string | null {
    const runtime = this.readNodeRuntime(node);

    return this.normalizeOptionalString(
      typeof runtime?.workerId === 'string' ? runtime.workerId : null,
    );
  }

  readNodeLeaseUntil(node: TaskNode): Date | null {
    const runtime = this.readNodeRuntime(node);
    const raw = this.normalizeOptionalString(
      typeof runtime?.leaseUntil === 'string' ? runtime.leaseUntil : null,
    );

    if (!raw) {
      return null;
    }

    const parsed = new Date(raw);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }

  ensureTemplateNodesSupported(nodes: Array<{ type?: string | null }>): void {
    const unsupportedNode = nodes.find((node) => node.type !== 'agent');

    if (unsupportedNode) {
      throw new ConflictException(
        'Workflow template only supports agent nodes',
      );
    }
  }

  normalizeOptionalString(value?: string | null): string | null {
    if (value === undefined || value === null) {
      return null;
    }

    const normalized = value.trim();
    return normalized || null;
  }

  normalizeGitBranch(value?: string | null): string | null {
    return this.normalizeOptionalString(value);
  }

  toObjectRecord(value: unknown): Record<string, unknown> {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      return {};
    }

    return { ...(value as Record<string, unknown>) };
  }

  private normalizeBoolean(value: unknown): boolean | null {
    if (typeof value === 'boolean') {
      return value;
    }

    return null;
  }

  private normalizeBooleanLike(value: unknown): boolean | null {
    if (typeof value === 'boolean') {
      return value;
    }

    if (typeof value === 'string') {
      const normalized = value.trim().toLowerCase();
      if (normalized === 'true') {
        return true;
      }
      if (normalized === 'false') {
        return false;
      }
    }

    if (typeof value === 'number') {
      if (value === 1) {
        return true;
      }
      if (value === 0) {
        return false;
      }
    }

    return null;
  }

  private normalizeNonNegativeInteger(value: unknown): number | null {
    if (typeof value === 'number' && Number.isFinite(value)) {
      const normalized = Math.floor(value);
      return normalized >= 0 ? normalized : null;
    }

    if (typeof value === 'string' && value.trim()) {
      const parsed = Number(value.trim());
      if (Number.isFinite(parsed)) {
        const normalized = Math.floor(parsed);
        return normalized >= 0 ? normalized : null;
      }
    }

    return null;
  }

  private normalizeMaxLoops(
    value: unknown,
    fallbackToOne = true,
  ): number | null {
    if (typeof value === 'number' && Number.isFinite(value)) {
      const normalized = Math.floor(value);
      if (normalized >= 1) {
        return normalized;
      }
    }

    if (typeof value === 'string' && value.trim()) {
      const parsed = Number(value.trim());
      if (Number.isFinite(parsed)) {
        const normalized = Math.floor(parsed);
        if (normalized >= 1) {
          return normalized;
        }
      }
    }

    return fallbackToOne ? 1 : null;
  }
}
