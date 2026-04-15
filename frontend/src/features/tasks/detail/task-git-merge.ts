import { tasksApi } from '@/api/tasks'
import type { TaskGitActionResult } from '@/types/api/tasks'

/**
 * 将任务当前分支合并入基准分支（与任务详情 Git 页「合并」一致）。
 * 封装 `POST /tasks/:id/git/merge`，供任务 Git 面板与需求计划「合并分支」复用。
 */
export async function mergeTaskBranchIntoBase(
  taskId: string,
  baseBranch: string | null | undefined,
): Promise<TaskGitActionResult> {
  const trimmed = baseBranch?.trim()
  return tasksApi.gitMerge(taskId, trimmed ? { baseBranch: trimmed } : {})
}
