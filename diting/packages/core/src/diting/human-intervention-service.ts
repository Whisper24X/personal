import { HumanReply, TitingTask, WaitReason } from "@diting/plugin-api";

/**
 * 人工介入：**ingestReply** 在进程内做 `replyId` 去重（与集成侧 `seenReplyIds` 互补，防双投）；
 * **resumeTask** / **pauseForWait** 委托 `TitingServices`。
 */
type HumanHost = {
  resumeTask(id: string, operator?: string, reason?: string): Promise<TitingTask>;
  pauseForWait(
    id: string,
    waitReason: Omit<WaitReason, "createdAt">,
    operator?: string,
    reason?: string
  ): Promise<TitingTask>;
  recoverTask(id: string, operator?: string, reason?: string): Promise<TitingTask>;
  markNeedsHuman(id: string, reason?: string, operator?: string): Promise<TitingTask>;
};

export class HumanInterventionService {
  private readonly seenReplyIds = new Set<string>();

  constructor(private readonly host: HumanHost) {}

  /** @returns 首次见到的 `replyId` 为 `true`，重复为 `false`。 */
  ingestReply(reply: HumanReply): boolean {
    if (this.seenReplyIds.has(reply.replyId)) {
      return false;
    }
    this.seenReplyIds.add(reply.replyId);
    return true;
  }

  resumeTask(taskId: string, operator?: string, reason?: string): Promise<TitingTask> {
    return this.host.resumeTask(taskId, operator, reason);
  }

  pauseForWait(
    taskId: string,
    waitReason: Omit<WaitReason, "createdAt">,
    operator?: string,
    reason?: string
  ): Promise<TitingTask> {
    return this.host.pauseForWait(taskId, waitReason, operator, reason);
  }

  recoverTask(taskId: string, operator?: string, reason?: string): Promise<TitingTask> {
    return this.host.recoverTask(taskId, operator, reason);
  }

  markNeedsHuman(taskId: string, reason?: string, operator?: string): Promise<TitingTask> {
    return this.host.markNeedsHuman(taskId, reason, operator);
  }
}
