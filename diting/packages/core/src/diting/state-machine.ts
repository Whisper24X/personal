/**
 * 任务状态机：显式允许的状态迁移表。
 *
 * - 终态 `succeeded` 不再迁出。
 * - 执行阶段（evaluating/repairing 等）由 RunAttempt.stage 表达，不作为 TaskStatus。
 * - `active -> ready` 用于调度器释放 claim（心跳超时、瞬时失败等）。
 *
 * @see assertValidTransition
 */
import { InvalidTransitionError } from "./errors";
import { TaskStatus } from "@diting/plugin-api";

const ALLOWED_TRANSITIONS: Record<TaskStatus, TaskStatus[]> = {
  draft: ["ready", "waiting", "cancelled"],
  ready: ["active", "waiting", "cancelled"],
  active: ["succeeded", "waiting", "failed", "ready", "cancelled"],
  waiting: ["ready", "cancelled"],
  succeeded: [],
  failed: ["ready", "cancelled"],
  cancelled: ["draft", "ready"]
};

/**
 * 校验 `from -> to` 是否在允许表内；否则抛出 `InvalidTransitionError`。
 * 所有持久化状态变更应通过此类校验，避免仓储与运行时逻辑分叉。
 */
export function assertValidTransition(from: TaskStatus, to: TaskStatus): void {
  if (!canTransition(from, to)) {
    throw new InvalidTransitionError(`Illegal task transition: ${from} -> ${to}`);
  }
}

/**
 * 非抛错版本：判断 `from -> to` 是否为合法迁移。
 * 用于运行时在多种目标状态之间选择（如重试入队 vs 内联重试），避免先 try/catch 再回退。
 */
export function canTransition(from: TaskStatus, to: TaskStatus): boolean {
  return ALLOWED_TRANSITIONS[from]?.includes(to) ?? false;
}
