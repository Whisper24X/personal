import { RepairGoal, TitingTask, WaitReason } from "@diting/plugin-api";

/**
 * 暴露与 **RepairGoal** / 人工终局相关的只读或状态变更 API，便于上层只依赖「修复闭环」子域。
 */
type RepairHost = {
  getRepairGoal(taskId: string): Promise<RepairGoal | null>;
  pauseForWait(
    id: string,
    waitReason: Omit<WaitReason, "createdAt">,
    operator?: string,
    reason?: string
  ): Promise<TitingTask>;
  markNeedsHuman(id: string, reason?: string, operator?: string): Promise<TitingTask>;
};

export class RepairLoopService {
  constructor(private readonly host: RepairHost) {}

  getRepairGoal(taskId: string): Promise<RepairGoal | null> {
    return this.host.getRepairGoal(taskId);
  }

  pauseForWait(
    taskId: string,
    waitReason: Omit<WaitReason, "createdAt">,
    operator?: string,
    reason?: string
  ): Promise<TitingTask> {
    return this.host.pauseForWait(taskId, waitReason, operator, reason);
  }

  markNeedsHuman(taskId: string, reason?: string, operator?: string): Promise<TitingTask> {
    return this.host.markNeedsHuman(taskId, reason, operator);
  }
}
