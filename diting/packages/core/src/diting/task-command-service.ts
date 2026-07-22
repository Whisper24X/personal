import { CreateTaskInput, TitingTask, WaitReason } from "@diting/plugin-api";
import type { HumanRepairIssueSyncResult } from "./services";

/**
 * `TitingServices` 上**写路径**子集的稳定外观：创建/提交/暂停/恢复/重试/取消等。
 * 用于 UI 或 API 层按「仅允许变更」维度拆分包（与 `TaskQueryService` 对称）。
 */
type CommandHost = {
  createTask(input: CreateTaskInput): Promise<TitingTask>;
  validateTask(id: string, operator?: string): Promise<TitingTask>;
  submitTask(id: string, operator?: string): Promise<TitingTask>;
  queueTask(id: string, operator?: string): Promise<TitingTask>;
  pauseForWait(id: string, waitReason: Omit<WaitReason, "createdAt">, operator?: string, reason?: string): Promise<TitingTask>;
  resumeTask(id: string, operator?: string, reason?: string): Promise<TitingTask>;
  retryTask(id: string, operator?: string): Promise<TitingTask>;
  reopenTask(id: string, operator?: string, target?: "draft" | "ready", reason?: string): Promise<TitingTask>;
  releaseTask(id: string, reason: string, operator?: string): Promise<TitingTask>;
  blockTask(id: string, reason?: string, operator?: string): Promise<TitingTask>;
  markNeedsHuman(id: string, reason?: string, operator?: string): Promise<TitingTask>;
  recoverTask(id: string, operator?: string, reason?: string): Promise<TitingTask>;
  syncHumanRepairIssue(id: string, operator?: string): Promise<HumanRepairIssueSyncResult>;
  cancelTask(id: string, operator?: string): Promise<TitingTask>;
};

export class TaskCommandService {
  constructor(private readonly host: CommandHost) {}

  createTask(input: CreateTaskInput): Promise<TitingTask> {
    return this.host.createTask(input);
  }

  validateTask(id: string, operator?: string): Promise<TitingTask> {
    return this.host.validateTask(id, operator);
  }

  submitTask(id: string, operator?: string): Promise<TitingTask> {
    return this.host.submitTask(id, operator);
  }

  queueTask(id: string, operator?: string): Promise<TitingTask> {
    return this.host.queueTask(id, operator);
  }

  pauseForWait(
    id: string,
    waitReason: Omit<WaitReason, "createdAt">,
    operator?: string,
    reason?: string
  ): Promise<TitingTask> {
    return this.host.pauseForWait(id, waitReason, operator, reason);
  }

  resumeTask(id: string, operator?: string, reason?: string): Promise<TitingTask> {
    return this.host.resumeTask(id, operator, reason);
  }

  retryTask(id: string, operator?: string): Promise<TitingTask> {
    return this.host.retryTask(id, operator);
  }

  reopenTask(
    id: string,
    operator?: string,
    target?: "draft" | "ready",
    reason?: string
  ): Promise<TitingTask> {
    return this.host.reopenTask(id, operator, target, reason);
  }

  releaseTask(id: string, reason: string, operator?: string): Promise<TitingTask> {
    return this.host.releaseTask(id, reason, operator);
  }

  blockTask(id: string, reason?: string, operator?: string): Promise<TitingTask> {
    return this.host.blockTask(id, reason, operator);
  }

  markNeedsHuman(id: string, reason?: string, operator?: string): Promise<TitingTask> {
    return this.host.markNeedsHuman(id, reason, operator);
  }

  recoverTask(id: string, operator?: string, reason?: string): Promise<TitingTask> {
    return this.host.recoverTask(id, operator, reason);
  }

  syncHumanRepairIssue(id: string, operator?: string): Promise<HumanRepairIssueSyncResult> {
    return this.host.syncHumanRepairIssue(id, operator);
  }

  cancelTask(id: string, operator?: string): Promise<TitingTask> {
    return this.host.cancelTask(id, operator);
  }
}
