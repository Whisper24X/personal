import type { Task } from '@/types/api/tasks'
import type { TaskStatus } from '@/types/api/tasks'

export type GoalStatus =
  | 'draft'
  | 'prd_generated'
  | 'prd_confirmed'
  | 'planned'
  | 'in_progress'
  | 'done'
  | 'archived'

/** 与后端 PlanGranularity 一致：任务计划 AI 拆解粒度 */
export type PlanGranularity = 'coarse' | 'conservative' | 'standard' | 'fine'

export type Goal = {
  id: string
  projectId: string
  title: string
  summary?: string | null
  status: GoalStatus
  prdDocPath?: string | null
  planDocPath?: string | null
  defaultWorkflowTemplateId?: string | null
  /** 生成 PRD/任务计划时默认使用的 Agent CLI */
  agentCliId?: string | null
  agentCliConfigId?: string | null
  /** 创建时选择的 Git 基准分支 */
  gitBaseBranch: string
  /** 为本需求创建的需求分支名 */
  gitBranch: string
  createdBy?: string | null
  createdAt: string
  updatedAt: string
  deletedAt?: string | null
}

export type GoalSourceDocType = 'prototype' | 'requirement' | 'reference'

export type GoalSourceDoc = {
  id: string
  goalId: string
  projectDocPath: string
  docType: GoalSourceDocType
  sortOrder: number
  createdAt: string
}

export type GoalPlanItemStatus =
  | 'draft'
  | 'approved'
  | 'task_created'
  | 'completed'
  | 'cancelled'

/** 功能组（父级），不直接物化为 Task */
export type GoalPlanItem = {
  id: string
  goalId: string
  title: string
  summary?: string | null
  acceptanceCriteria?: string | null
  suggestedPrompt?: string | null
  dependsOnItemIds: string[]
  itemOrder: number
  /** 该功能组对应的 Git 分支（确认子任务创建前可为空） */
  gitBranch: string | null
  createdAt: string
  updatedAt: string
  /** 详情接口嵌套的子任务 */
  subTasks?: GoalPlanSubTask[]
}

/** 计划子任务（唯一可新建 Task 的单元） */
export type GoalPlanSubTask = {
  id: string
  goalPlanItemId: string
  title: string
  summary?: string | null
  acceptanceCriteria?: string | null
  suggestedPrompt?: string | null
  dependsOnSubTaskIds: string[]
  itemOrder: number
  taskId?: string | null
  workflowTemplateId?: string | null
  status: GoalPlanItemStatus
  createdAt: string
  updatedAt: string
}

export type TaskDependencyEdge = {
  id: string
  predecessorTaskId: string
  successorTaskId: string
  relationType: 'blocks'
  createdAt: string
}

/** 子任务维度：总数不含已取消；完成数 = 已物化且对应 Task 为 done 的子任务 */
export type GoalProgress = {
  totalTasks: number
  doneTasks: number
  percent: number
  statusCounts: Record<TaskStatus, number>
}

export type GoalDetail = {
  goal: Goal
  sourceDocs: GoalSourceDoc[]
  planItems: GoalPlanItem[]
  tasks: Task[]
  taskDependencies: TaskDependencyEdge[]
  progress: GoalProgress
}

/** 用于依赖图等：扁平子任务列表；图中另含功能组 dependsOnItemIds 边，见 goal-plan-dependency-graph */
export function flattenGoalPlanSubTasks(detail: GoalDetail): GoalPlanSubTask[] {
  const out: GoalPlanSubTask[] = []
  for (const g of detail.planItems) {
    for (const st of g.subTasks ?? []) {
      out.push(st)
    }
  }
  return out
}
